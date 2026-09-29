'use client';

import React, { useState, useMemo } from 'react';
import { Shell } from '@/components/layout/Shell';
import { useAppStore } from '@/stores/app-store';
import { dbSet } from '@/lib/firebase/repository';
import { LPSReport } from '@/types/lps';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { computeSHA256 } from '@/lib/cache/offline-cache';
import { GraduationCap, Lock, CheckCircle2, Calendar, FileText, Printer } from 'lucide-react';

const PERIODS = [
  { id: 'lps_mid_s1', label: 'LPS Mid Semester 1' },
  { id: 'blp_final_s1', label: 'BLP Final Semester 1' },
  { id: 'lps_mid_s2', label: 'LPS Mid Semester 2' },
  { id: 'blp_final_s2', label: 'BLP Final Semester 2' }
] as const;

export default function LPSPage() {
  const { toast } = useToast();
  const activeKelas = useAppStore((state) => state.activeKelas);
  const academicYear = useAppStore((state) => state.academicYear);
  const studentsMap = useAppStore((state) => state.students);
  const lpsReports = useAppStore((state) => state.lpsReports);

  const [selectedPeriod, setSelectedPeriod] = useState<typeof PERIODS[number]['id']>('lps_mid_s1');
  const [selectedNisn, setSelectedNisn] = useState<string>('');
  const [hijriOffset, setHijriOffset] = useState<number>(0);

  // Form Evaluasi Aspek
  const [catatanWali, setCatatanWali] = useState('Ananda menunjukkan perkembangan karakter islami yang sangat baik.');
  const [isFinalizing, setIsFinalizing] = useState(false);

  const classStudents = useMemo(() => {
    return Object.values(studentsMap)
      .filter((s) => s.Kelas === activeKelas)
      .sort((a, b) => a['Nama Lengkap'].localeCompare(b['Nama Lengkap']));
  }, [studentsMap, activeKelas]);

  React.useEffect(() => {
    if (classStudents.length && !selectedNisn) {
      setSelectedNisn(classStudents[0].NISN);
    }
  }, [classStudents, selectedNisn]);

  const activeStudent = useMemo(() => {
    return classStudents.find((s) => s.NISN === selectedNisn);
  }, [classStudents, selectedNisn]);

  // Handle finalize and lock report with SHA-256
  const handleFinalizeReport = async () => {
    if (!activeStudent) return;
    setIsFinalizing(true);

    const reportId = `REPORT_${selectedPeriod}_${activeStudent.NISN}`;
    const payloadData = {
      period: selectedPeriod,
      nisn: activeStudent.NISN,
      kelas: activeKelas,
      waliKelasNotes: catatanWali,
      finalizedAt: new Date().toISOString()
    };

    const hash = await computeSHA256(JSON.stringify(payloadData));

    const finalReport: LPSReport = {
      id: reportId,
      period: selectedPeriod,
      status: 'final',
      hash,
      gregorianDate: new Date().toISOString().split('T')[0],
      hijriDate: '1448 H',
      templateSnapshot: { templateVersion: 3, reportType: 'LPS', sections: [] },
      studentSnapshot: activeStudent,
      evaluations: { sikap: 'Sangat Baik', ibadah: 'Terbiasa' },
      notes: { waliKelas: catatanWali }
    };

    const res = await dbSet<LPSReport>(`LPS/Reports/${reportId}`, finalReport, activeKelas, academicYear);
    setIsFinalizing(false);

    if (res.success) {
      toast(`Rapor ananda ${activeStudent['Nama Lengkap']} berhasil dikunci final (SHA-256: ${hash.substring(0, 10)}...)`, 'success');
    } else {
      toast(res.error || 'Gagal memfinalisasi rapor.', 'error');
    }
  };

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Sistem Evaluasi Rapor LPS & BLP - Kelas {activeKelas}
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Lembar Perkembangan Siswa & Buku Laporan Pendidikan Tahun Ajaran {academicYear}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as typeof PERIODS[number]['id'])}
              className="px-3 py-1.5 text-xs bg-indigo-600 text-white font-semibold rounded-xl border-0"
            >
              {PERIODS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Student Selector Bar */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Pilih Siswa:</span>
            <select
              value={selectedNisn}
              onChange={(e) => setSelectedNisn(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold"
            >
              {classStudents.map((s) => (
                <option key={s.NISN} value={s.NISN}>
                  {s['Nama Lengkap']} ({s.NISN})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Penyesuaian Kalender Hijriah:</span>
            <div className="flex items-center gap-1">
              {[-2, -1, 0, 1, 2].map((offset) => (
                <button
                  key={offset}
                  onClick={() => setHijriOffset(offset)}
                  className={`w-6 h-6 rounded-md text-[10px] font-bold ${
                    hijriOffset === offset ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-zinc-800'
                  }`}
                >
                  {offset > 0 ? `+${offset}` : offset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Evaluation Sheet Preview */}
        {activeStudent && (
          <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  {activeStudent['Nama Lengkap']}
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">NISN: {activeStudent.NISN} • Kelas {activeStudent.Kelas}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-1.5" /> Cetak Lembar A4
                </Button>
                <Button variant="primary" size="sm" onClick={handleFinalizeReport} isLoading={isFinalizing}>
                  <Lock className="w-4 h-4 mr-1.5" /> Finalisasi & Kunci (SHA-256)
                </Button>
              </div>
            </div>

            {/* Aspek Evaluasi Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-100 dark:border-zinc-800">
                <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 mb-2">1. Sikap Spiritual & Adab</h3>
                <p className="text-[11px] text-slate-500 mb-2">Kedisiplinan ibadah sholat dan interaksi santun.</p>
                <span className="inline-block px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 font-bold text-[10px] rounded">
                  Sangat Baik (A)
                </span>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-100 dark:border-zinc-800">
                <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 mb-2">2. Capaian Tilawah & Hafalan</h3>
                <p className="text-[11px] text-slate-500 mb-2">Kelancaran makhraj huruf dan kelengkapan surah Juz 30.</p>
                <span className="inline-block px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 font-bold text-[10px] rounded">
                  Berkembang Sesuai Harapan (B)
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Catatan Narasi Perkembangan (Wali Kelas)
              </label>
              <textarea
                rows={3}
                value={catatanWali}
                onChange={(e) => setCatatanWali(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
