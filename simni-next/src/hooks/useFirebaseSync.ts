'use client';

import { useEffect } from 'react';
import { ref, onValue, Unsubscribe } from 'firebase/database';
import { getFirebaseClient } from '@/lib/firebase/client';
import { resolveDatabasePath } from '@/lib/firebase/paths';
import { useAppStore } from '@/stores/app-store';
import { useSyncStore } from '@/stores/sync-store';
import { Student } from '@/types/student';
import { LearningObjective } from '@/types/grade';

const IS_MOCK = process.env.NEXT_PUBLIC_MOCK_DATABASE === 'true';

// Sample mock data untuk pengujian lokal terisolasi
const MOCK_STUDENTS: Record<string, Student> = {
  '0123456781': { ID_Siswa: 'SISWA_01', NISN: '0123456781', 'Nama Lengkap': 'Ahmad Fauzan Pratama', Panggilan: 'Fauzan', Kelas: '1A', Kelompok: 'Kelompok Abu Bakar' },
  '0123456782': { ID_Siswa: 'SISWA_02', NISN: '0123456782', 'Nama Lengkap': 'Aisyah Putri Azzahra', Panggilan: 'Aisyah', Kelas: '1A', Kelompok: 'Kelompok Khadijah' },
  '0123456783': { ID_Siswa: 'SISWA_03', NISN: '0123456783', 'Nama Lengkap': 'Bilal Al-Ghifari', Panggilan: 'Bilal', Kelas: '1A', Kelompok: 'Kelompok Abu Bakar' },
  '0123456784': { ID_Siswa: 'SISWA_04', NISN: '0123456784', 'Nama Lengkap': 'Fathimah Nurul Izzah', Panggilan: 'Izzah', Kelas: '1A', Kelompok: 'Kelompok Khadijah' },
  '0123456785': { ID_Siswa: 'SISWA_05', NISN: '0123456785', 'Nama Lengkap': 'Muhammad Rayhan Pratama', Panggilan: 'Rayhan', Kelas: '1A', Kelompok: 'Kelompok Umar' },
  // Siswa Kelas 3A dari Template Wajib BTQ & LPS
  '0133456701': { ID_Siswa: 'SISWA_3A_01', NISN: '0133456701', 'Nama Lengkap': 'Athallah Hafiz Ramdani', Panggilan: 'Athallah', Kelas: '3A', Kelompok: 'Kelompok Shiddiq' },
  '0133456702': { ID_Siswa: 'SISWA_3A_02', NISN: '0133456702', 'Nama Lengkap': 'Ayken Rayhan Razzad', Panggilan: 'Ayken', Kelas: '3A', Kelompok: 'Kelompok Amanah' },
  '0133456703': { ID_Siswa: 'SISWA_3A_03', NISN: '0133456703', 'Nama Lengkap': 'Danu Sena Adji', Panggilan: 'Danu', Kelas: '3A', Kelompok: 'Kelompok Fathonah' },
  '0133456704': { ID_Siswa: 'SISWA_3A_04', NISN: '0133456704', 'Nama Lengkap': 'Hakam Irhab Munib', Panggilan: 'Hakam', Kelas: '3A', Kelompok: 'Kelompok Tabligh' },
  '0133456705': { ID_Siswa: 'SISWA_3A_05', NISN: '0133456705', 'Nama Lengkap': 'Mouri Glazy Atreya', Panggilan: 'Mouri', Kelas: '3A', Kelompok: 'Kelompok Shiddiq' },
  '0133456706': { ID_Siswa: 'SISWA_3A_06', NISN: '0133456706', 'Nama Lengkap': 'Raden Anaking Muhammad Jaluna Firmansyah', Panggilan: 'Jaluna', Kelas: '3A', Kelompok: 'Kelompok Amanah' },
  '0133456707': { ID_Siswa: 'SISWA_3A_07', NISN: '0133456707', 'Nama Lengkap': 'Shakila Karaputri Prabowo', Panggilan: 'Shakila', Kelas: '3A', Kelompok: 'Kelompok Khadijah' },
};

const MOCK_TP: Record<string, LearningObjective> = {
  'TP_01': { ID_mapel: 'TP_01', kode_tp: 'MAT-1.1', mapel: 'Matematika', bab: 'Bab 1', semester: '1', deskripsi: 'Mengenal bilangan cacah 1 sampai 20 dan nilai tempatnya.' },
  'TP_02': { ID_mapel: 'TP_02', kode_tp: 'BIN-1.1', mapel: 'Bahasa Indonesia', bab: 'Bab 1', semester: '1', deskripsi: 'Menirukan bunyi huruf dan membaca kata sederhana dengan lancar.' },
  'TP_03': { ID_mapel: 'TP_03', kode_tp: 'PAI-1.1', mapel: 'Pendidikan Agama Islam', bab: 'Bab 1', semester: '1', deskripsi: 'Mengenal rukun Islam dan menghafal Surah Al-Fatihah dengan benar.' },
};

export function useFirebaseSync() {
  const activeKelas = useAppStore((state) => state.activeKelas);
  const academicYear = useAppStore((state) => state.academicYear);
  const setCollection = useAppStore((state) => state.setCollection);

  const setHealth = useSyncStore((state) => state.setHealth);
  const setIsConnected = useSyncStore((state) => state.setIsConnected);
  const setLastSyncedAt = useSyncStore((state) => state.setLastSyncedAt);

  useEffect(() => {
    // Mode Sandbox: Isolasi 100% dari Cloud
    if (IS_MOCK) {
      console.log('🛡️ SIMNI Sandbox Mode: Database Cloud dilindungi 100%. Menggunakan Mock Data lokal.');
      setHealth('ready');
      setIsConnected(true);
      setLastSyncedAt(new Date().toISOString());

      // Injeksi data lokal untuk kelas aktif jika belum ada
      setCollection('students', MOCK_STUDENTS);
      setCollection('mapelTP', MOCK_TP);
      return;
    }

    const { database } = getFirebaseClient();
    const unsubs: Unsubscribe[] = [];

    // 1. Connection Monitor
    const connectedRef = ref(database, '.info/connected');
    const unsubConn = onValue(connectedRef, (snap) => {
      const connected = !!snap.val();
      setIsConnected(connected);
      if (!connected) setHealth('degraded');
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
  }, [activeKelas, academicYear, setCollection, setHealth, setIsConnected, setLastSyncedAt]);
}
