'use client';

import React, { useState, useMemo } from 'react';
import { Shell } from '@/components/layout/Shell';
import { useAppStore } from '@/stores/app-store';
import { dbUpdate } from '@/lib/firebase/repository';
import { AttendanceRecord } from '@/types/attendance';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { getJakartaDateString } from '@/lib/utils/date';
import { CalendarCheck, Save, CheckCircle2, UserCheck, BarChart3, AlertCircle } from 'lucide-react';

export default function AttendancePage() {
  const { toast } = useToast();
  const activeKelas = useAppStore((state) => state.activeKelas);
  const academicYear = useAppStore((state) => state.academicYear);
  const studentsMap = useAppStore((state) => state.students);
  const presensiMap = useAppStore((state) => state.presensi);

  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('input');
  const [selectedDate, setSelectedDate] = useState<string>(getJakartaDateString());
  const [dailyStatus, setDailyStatus] = useState<Record<string, 'Hadir' | 'Sakit' | 'Izin' | 'Alpa'>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter students for active class
  const classStudents = useMemo(() => {
    return Object.values(studentsMap)
      .filter((s) => s.Kelas === activeKelas)
      .sort((a, b) => a['Nama Lengkap'].localeCompare(b['Nama Lengkap']));
  }, [studentsMap, activeKelas]);

  // Load attendance records for selected date
  const currentAttendance = useMemo(() => {
    const map: Record<string, 'Hadir' | 'Sakit' | 'Izin' | 'Alpa'> = {};
    Object.values(presensiMap).forEach((rec) => {
      if (rec.Kelas === activeKelas && rec.Tanggal === selectedDate) {
        map[rec.NISN] = rec.Status;
      }
    });
    return map;
  }, [presensiMap, activeKelas, selectedDate]);

  // Sync state when date changes
  React.useEffect(() => {
    setDailyStatus(currentAttendance);
  }, [currentAttendance]);

  const handleStatusChange = (nisn: string, status: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa') => {
    setDailyStatus((prev) => ({ ...prev, [nisn]: status }));
  };

  const handleMarkAllHadir = () => {
    const allHadir: Record<string, 'Hadir' | 'Sakit' | 'Izin' | 'Alpa'> = {};
    classStudents.forEach((s) => {
      allHadir[s.NISN] = 'Hadir';
    });
    setDailyStatus(allHadir);
    toast('Semua siswa ditandai Hadir.', 'info');
  };

  const handleSaveAttendance = async () => {
    if (!classStudents.length) return;
    setIsSubmitting(true);

    const updates: Record<string, AttendanceRecord> = {};
    classStudents.forEach((s) => {
      const status = dailyStatus[s.NISN] || 'Hadir';
      const recordKey = `Presensi/${selectedDate}_${s.NISN}`;
      updates[recordKey] = {
        Tanggal: selectedDate,
        NISN: s.NISN,
        'Nama Lengkap': s['Nama Lengkap'],
        Status: status,
        Kelas: activeKelas
      };
    });

    const res = await dbUpdate(updates, activeKelas, academicYear);
    setIsSubmitting(false);

    if (res.success) {
      toast(`Presensi tanggal ${selectedDate} berhasil disimpan.`, 'success');
    } else {
      toast(res.error || 'Gagal menyimpan presensi.', 'error');
    }
  };

  // Compute student attendance summary (recap)
  const attendanceRecap = useMemo(() => {
    const recap: Record<string, { hadir: number; sakit: number; izin: number; alpa: number; total: number }> = {};
    classStudents.forEach((s) => {
      recap[s.NISN] = { hadir: 0, sakit: 0, izin: 0, alpa: 0, total: 0 };
    });

    Object.values(presensiMap).forEach((rec) => {
      if (rec.Kelas === activeKelas && recap[rec.NISN]) {
        recap[rec.NISN].total += 1;
        if (rec.Status === 'Hadir') recap[rec.NISN].hadir += 1;
        else if (rec.Status === 'Sakit') recap[rec.NISN].sakit += 1;
        else if (rec.Status === 'Izin') recap[rec.NISN].izin += 1;
        else if (rec.Status === 'Alpa') recap[rec.NISN].alpa += 1;
      }
    });

    return recap;
  }, [presensiMap, classStudents, activeKelas]);

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Presensi Kehadiran Siswa - Kelas {activeKelas}
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Tahun Ajaran {academicYear} • {classStudents.length} siswa aktif
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('input')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'input'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              Isi Presensi
            </button>
            <button
              onClick={() => setActiveTab('rekap')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'rekap'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              Rekapitulasi Kehadiran
            </button>
          </div>
        </div>

        {activeTab === 'input' ? (
          <div className="space-y-4">
            {/* Control Bar */}
            <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 shrink-0">
                  Tanggal Presensi:
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button variant="outline" size="sm" onClick={handleMarkAllHadir}>
                  <UserCheck className="w-4 h-4" /> Hadir Semua
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveAttendance} isLoading={isSubmitting}>
                  <Save className="w-4 h-4" /> Simpan Presensi
                </Button>
              </div>
            </div>

            {/* Attendance Table */}
            {classStudents.length > 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200/80 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 w-12 text-center">No</th>
                        <th className="px-4 py-3">Nama Siswa</th>
                        <th className="px-4 py-3 text-center">Status Kehadiran</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                      {classStudents.map((student, idx) => {
                        const status = dailyStatus[student.NISN] || 'Hadir';
                        return (
                          <tr key={student.NISN} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-900 dark:text-zinc-100">{student['Nama Lengkap']}</p>
                              <p className="text-[10px] text-slate-400 font-mono">NISN: {student.NISN}</p>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                                {(
                                  [
                                    { key: 'Hadir', label: 'H', activeColor: 'bg-emerald-600 text-white' },
                                    { key: 'Sakit', label: 'S', activeColor: 'bg-blue-600 text-white' },
                                    { key: 'Izin', label: 'I', activeColor: 'bg-amber-500 text-white' },
                                    { key: 'Alpa', label: 'A', activeColor: 'bg-rose-600 text-white' }
                                  ] as const
                                ).map((opt) => (
                                  <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => handleStatusChange(student.NISN, opt.key)}
                                    className={`w-8 h-8 rounded-xl font-bold text-xs transition-all ${
                                      status === opt.key
                                        ? `${opt.activeColor} shadow-md`
                                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl text-center">
                <p className="text-xs text-slate-400 font-medium">Belum ada siswa terdaftar pada kelas {activeKelas}.</p>
              </div>
            )}
          </div>
        ) : (
          /* Rekapitulasi Panel */
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-500" /> Rekapitulasi Kehadiran Kumulatif
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200/80 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Nama Siswa</th>
                    <th className="px-4 py-3 text-center text-emerald-600 font-bold">Hadir</th>
                    <th className="px-4 py-3 text-center text-blue-600 font-bold">Sakit</th>
                    <th className="px-4 py-3 text-center text-amber-600 font-bold">Izin</th>
                    <th className="px-4 py-3 text-center text-rose-600 font-bold">Alpa</th>
                    <th className="px-4 py-3 text-center">Kehadiran (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {classStudents.map((student) => {
                    const r = attendanceRecap[student.NISN] || { hadir: 0, sakit: 0, izin: 0, alpa: 0, total: 0 };
                    const pct = r.total > 0 ? Math.round((r.hadir / r.total) * 100) : 100;
                    return (
                      <tr key={student.NISN} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-zinc-200">
                          {student['Nama Lengkap']}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-emerald-600">{r.hadir}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-blue-600">{r.sakit}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-amber-600">{r.izin}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-rose-600">{r.alpa}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                            pct >= 90 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60'
                          }`}>
                            {pct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
