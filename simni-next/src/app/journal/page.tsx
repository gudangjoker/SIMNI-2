'use client';

import React, { useState, useMemo } from 'react';
import { Shell } from '@/components/layout/Shell';
import { useAppStore } from '@/stores/app-store';
import { dbSet, dbRemove } from '@/lib/firebase/repository';
import { JournalEntry, ScheduleSlot } from '@/types/journal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { getJakartaDateString } from '@/lib/utils/date';
import { BookOpen, Calendar, Clock, Plus, Trash2, CalendarDays } from 'lucide-react';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'] as const;
const HOURS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const MAPEL_OPTIONS = [
  'Pendidikan Agama Islam',
  'Pendidikan Pancasila',
  'Bahasa Indonesia',
  'Matematika',
  'IPAS',
  'PJOK',
  'Seni Rupa',
  'Seni Musik',
  'Bahasa Inggris',
  'Bahasa Sunda',
  'Istirahat',
  '-Kosong-'
];

export default function JournalPage() {
  const { toast } = useToast();
  const activeKelas = useAppStore((state) => state.activeKelas);
  const academicYear = useAppStore((state) => state.academicYear);
  const journalMap = useAppStore((state) => state.jurnal);
  const scheduleMap = useAppStore((state) => state.jadwal);

  const [activeTab, setActiveTab] = useState<'harian' | 'jadwal' | 'rekap'>('harian');

  // Form Jurnal Harian
  const [tanggal, setTanggal] = useState(getJakartaDateString());
  const [jamKe, setJamKe] = useState('1');
  const [mapel, setMapel] = useState(MAPEL_OPTIONS[0]);
  const [materi, setMateri] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Jadwal Master Matrix State
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Journal entries for active class
  const classJournals = useMemo(() => {
    return Object.entries(journalMap)
      .map(([id, j]) => ({ id, ...j }))
      .filter((j) => j.Kelas === activeKelas)
      .sort((a, b) => new Date(b.Tanggal).getTime() - new Date(a.Tanggal).getTime());
  }, [journalMap, activeKelas]);

  const handleSaveJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materi.trim()) {
      toast('Materi pembelajaran wajib diisi.', 'warning');
      return;
    }

    setIsSubmitting(true);
    const journalId = `JRN_${tanggal}_${jamKe}_${activeKelas}`;
    const payload: JournalEntry = {
      Tanggal: tanggal,
      Jam_Ke: jamKe,
      Mapel: mapel,
      Materi: materi.trim(),
      Keterangan: keterangan.trim(),
      Kelas: activeKelas
    };

    const res = await dbSet<JournalEntry>(`Jurnal/${journalId}`, payload, activeKelas, academicYear);
    setIsSubmitting(false);

    if (res.success) {
      toast('Jurnal kegiatan mengajar berhasil disimpan.', 'success');
      setMateri('');
      setKeterangan('');
    } else {
      toast(res.error || 'Gagal menyimpan jurnal.', 'error');
    }
  };

  const handleDeleteJournal = async (id: string) => {
    if (!window.confirm('Hapus entri jurnal mengajar ini?')) return;
    const res = await dbRemove(`Jurnal/${id}`, activeKelas, academicYear);
    if (res.success) {
      toast('Jurnal berhasil dihapus.', 'success');
    } else {
      toast(res.error || 'Gagal menghapus jurnal.', 'error');
    }
  };

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Jurnal Mengajar & Jadwal Pelajaran - Kelas {activeKelas}
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Administrasi agenda harian pembelajaran dan matriks jadwal mingguan tahun ajaran {academicYear}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('harian')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'harian'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              Isi Jurnal
            </button>
            <button
              onClick={() => setActiveTab('jadwal')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'jadwal'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              Matriks Jadwal
            </button>
            <button
              onClick={() => setActiveTab('rekap')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'rekap'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              Riwayat Jurnal
            </button>
          </div>
        </div>

        {activeTab === 'harian' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Jurnal */}
            <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-sm h-fit">
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" /> Tulis Agenda Harian
              </h2>

              <form onSubmit={handleSaveJournal} className="space-y-4">
                <Input
                  label="Tanggal Pembelajaran"
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  required
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Jam Ke</label>
                    <select
                      value={jamKe}
                      onChange={(e) => setJamKe(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl"
                    >
                      {HOURS.map((h) => (
                        <option key={h} value={h}>
                          Jam Ke-{h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Mata Pelajaran</label>
                    <select
                      value={mapel}
                      onChange={(e) => setMapel(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl"
                    >
                      {MAPEL_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Materi Pokok / Pembahasan
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Contoh: Operasi hitung perkalian pecahan dengan media kartu..."
                    value={materi}
                    onChange={(e) => setMateri(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Keterangan & Refleksi Kelas
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Pembelajaran kondusif, 3 siswa butuh bimbingan tambahan..."
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <Button type="submit" variant="primary" className="w-full" size="sm" isLoading={isSubmitting}>
                  Simpan Jurnal Mengajar
                </Button>
              </form>
            </div>

            {/* Recent Entries */}
            <div className="lg:col-span-2 space-y-3">
              <h2 className="text-xs font-bold text-slate-800 dark:text-zinc-200 mb-2">Entri Jurnal Terbaru</h2>
              {classJournals.slice(0, 5).map((j) => (
                <div
                  key={j.id}
                  className="p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] rounded">
                        Jam Ke-{j.Jam_Ke}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">{j.Mapel}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{j.Tanggal}</span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-zinc-300 mt-2 font-medium">{j.Materi}</p>
                  {j.Keterangan && (
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 italic">
                      Refleksi: {j.Keterangan}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'jadwal' && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-500" /> Matriks Jadwal Mingguan
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6">
              Jadwal ini secara otomatis menyelaraskan mata pelajaran pada formulir jurnal mengajar harian.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <thead className="bg-slate-50 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 uppercase font-semibold">
                  <tr>
                    <th className="px-3 py-2 text-center border-r border-slate-200 dark:border-zinc-800 w-16">Jam</th>
                    {DAYS.map((d) => (
                      <th key={d} className="px-3 py-2 border-r border-slate-200 dark:border-zinc-800 last:border-0 text-center">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                  {HOURS.map((h) => (
                    <tr key={h} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-3 py-2 text-center font-bold text-slate-400 bg-slate-50/50 dark:bg-zinc-800/30 border-r border-slate-200 dark:border-zinc-800 font-mono">
                        {h}
                      </td>
                      {DAYS.map((d) => (
                        <td key={d} className="p-1 border-r border-slate-200 dark:border-zinc-800 last:border-0">
                          <select className="w-full px-2 py-1 text-[11px] bg-transparent rounded border-0 focus:ring-1 focus:ring-indigo-500">
                            {MAPEL_OPTIONS.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'rekap' && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800">
              <h2 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                Semua Riwayat Jurnal Mengajar ({classJournals.length} Entri)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200/80 dark:border-zinc-800 text-slate-500 font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3 text-center">Jam</th>
                    <th className="px-4 py-3">Mata Pelajaran</th>
                    <th className="px-4 py-3">Materi Pembelajaran</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {classJournals.map((j) => (
                    <tr key={j.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-zinc-400 whitespace-nowrap">{j.Tanggal}</td>
                      <td className="px-4 py-3 text-center font-bold font-mono">{j.Jam_Ke}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-zinc-100">{j.Mapel}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-zinc-300">{j.Materi}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDeleteJournal(j.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Hapus Jurnal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
