'use client';

import React, { useState, useMemo } from 'react';
import { Shell } from '@/components/layout/Shell';
import { useAppStore } from '@/stores/app-store';
import { dbSet, dbUpdate, dbRemove } from '@/lib/firebase/repository';
import { LearningObjective, Grade } from '@/types/grade';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Award, Plus, Trash2, BookOpen, Save, FileSpreadsheet, User } from 'lucide-react';

const MAPEL_LIST = [
  'Pendidikan Agama Islam',
  'Pendidikan Pancasila',
  'Bahasa Indonesia',
  'Matematika',
  'IPAS',
  'PJOK',
  'Seni Rupa',
  'Seni Musik',
  'Bahasa Inggris',
  'Bahasa Sunda'
];

export default function GradesPage() {
  const { toast } = useToast();
  const activeKelas = useAppStore((state) => state.activeKelas);
  const academicYear = useAppStore((state) => state.academicYear);
  const studentsMap = useAppStore((state) => state.students);
  const mapelTPMap = useAppStore((state) => state.mapelTP);
  const nilaiTPMap = useAppStore((state) => state.nilaiTP);

  const [activeTab, setActiveTab] = useState<'input' | 'kelola' | 'induk'>('input');

  // Input Nilai State
  const [selectedMapel, setSelectedMapel] = useState(MAPEL_LIST[0]);
  const [selectedTPId, setSelectedTPId] = useState<string>('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [isSavingScores, setIsSavingScores] = useState(false);

  // Kelola TP State
  const [isAddTPOpen, setIsAddTPOpen] = useState(false);
  const [tpKode, setTpKode] = useState('');
  const [tpBab, setTpBab] = useState('Bab 1');
  const [tpSemester, setTpSemester] = useState<'1' | '2'>('1');
  const [tpDeskripsi, setTpDeskripsi] = useState('');
  const [isSubmittingTP, setIsSubmittingTP] = useState(false);

  // Active class students
  const classStudents = useMemo(() => {
    return Object.values(studentsMap)
      .filter((s) => s.Kelas === activeKelas)
      .sort((a, b) => a['Nama Lengkap'].localeCompare(b['Nama Lengkap']));
  }, [studentsMap, activeKelas]);

  // Filtered TPs for selected Mapel
  const mapelTPs = useMemo(() => {
    return Object.entries(mapelTPMap)
      .map(([id, tp]) => ({ id, ...tp }))
      .filter((tp) => tp.mapel === selectedMapel);
  }, [mapelTPMap, selectedMapel]);

  // Load scores when TP changes
  React.useEffect(() => {
    if (!selectedTPId) {
      setScores({});
      return;
    }
    const currentScores: Record<string, number> = {};
    Object.values(nilaiTPMap).forEach((grade) => {
      if (grade.learningObjectiveId === selectedTPId && grade.Kelas === activeKelas) {
        currentScores[grade.NISN] = grade.nilai;
      }
    });
    setScores(currentScores);
  }, [selectedTPId, nilaiTPMap, activeKelas]);

  const handleScoreChange = (nisn: string, value: string) => {
    const num = value === '' ? 0 : Math.min(100, Math.max(0, parseInt(value, 10) || 0));
    setScores((prev) => ({ ...prev, [nisn]: num }));
  };

  const handleSaveScores = async () => {
    if (!selectedTPId) {
      toast('Silakan pilih Tujuan Pembelajaran (TP) terlebih dahulu.', 'warning');
      return;
    }
    if (!classStudents.length) return;

    setIsSavingScores(true);
    const updates: Record<string, Grade> = {};
    classStudents.forEach((student) => {
      const score = scores[student.NISN] ?? 0;
      const key = `Nilai_TP/${selectedTPId}_${student.NISN}`;
      updates[key] = {
        NISN: student.NISN,
        learningObjectiveId: selectedTPId,
        nilai: score,
        mapel: selectedMapel,
        Kelas: activeKelas,
        'Nama Lengkap': student['Nama Lengkap']
      };
    });

    const res = await dbUpdate(updates, activeKelas, academicYear);
    setIsSavingScores(false);

    if (res.success) {
      toast('Nilai TP seluruh siswa berhasil disimpan ke database.', 'success');
    } else {
      toast(res.error || 'Gagal menyimpan nilai.', 'error');
    }
  };

  const handleAddTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpKode.trim() || !tpDeskripsi.trim()) {
      toast('Kode TP dan deskripsi wajib diisi.', 'warning');
      return;
    }

    setIsSubmittingTP(true);
    const tpId = `TP_${Date.now()}`;
    const payload: LearningObjective = {
      ID_mapel: tpId,
      kode_tp: tpKode.trim(),
      mapel: selectedMapel,
      bab: tpBab,
      semester: tpSemester,
      deskripsi: tpDeskripsi.trim()
    };

    const res = await dbSet<LearningObjective>(`Mapel_TP/${tpId}`, payload, activeKelas, academicYear);
    setIsSubmittingTP(false);

    if (res.success) {
      toast('Tujuan Pembelajaran berhasil ditambahkan.', 'success');
      setTpKode('');
      setTpDeskripsi('');
      setIsAddTPOpen(false);
      setSelectedTPId(tpId);
    } else {
      toast(res.error || 'Gagal menambahkan TP.', 'error');
    }
  };

  const handleDeleteTP = async (tpId: string) => {
    if (!window.confirm('Hapus Tujuan Pembelajaran ini beserta nilai yang telah diinput?')) return;
    const res = await dbRemove(`Mapel_TP/${tpId}`, activeKelas, academicYear);
    if (res.success) {
      toast('TP berhasil dihapus.', 'success');
      if (selectedTPId === tpId) setSelectedTPId('');
    } else {
      toast(res.error || 'Gagal menghapus TP.', 'error');
    }
  };

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Manajemen Nilai & TP - Kelas {activeKelas}
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Capaian Tujuan Pembelajaran Kurikulum Merdeka Tahun {academicYear}
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
              Input Nilai TP
            </button>
            <button
              onClick={() => setActiveTab('kelola')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'kelola'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              Kelola TP
            </button>
            <button
              onClick={() => setActiveTab('induk')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'induk'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              Buku Induk
            </button>
          </div>
        </div>

        {/* Filter Mapel Global */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">Mata Pelajaran:</span>
          <select
            value={selectedMapel}
            onChange={(e) => {
              setSelectedMapel(e.target.value);
              setSelectedTPId('');
            }}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-semibold"
          >
            {MAPEL_LIST.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {activeTab === 'input' && (
          <div className="space-y-4">
            {/* TP Selector Bar */}
            <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 shrink-0">Pilih TP:</span>
                <select
                  value={selectedTPId}
                  onChange={(e) => setSelectedTPId(e.target.value)}
                  className="w-full max-w-xl px-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                >
                  <option value="">-- Pilih Tujuan Pembelajaran --</option>
                  {mapelTPs.map((tp) => (
                    <option key={tp.id} value={tp.id}>
                      [{tp.kode_tp}] {tp.deskripsi}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={handleSaveScores} isLoading={isSavingScores} disabled={!selectedTPId}>
                  <Save className="w-4 h-4" /> Simpan Semua Nilai
                </Button>
              </div>
            </div>

            {/* Score Grid Table */}
            {selectedTPId ? (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200/80 dark:border-zinc-800 text-slate-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">No</th>
                      <th className="px-4 py-3">Nama Siswa</th>
                      <th className="px-4 py-3 w-40 text-center">Nilai TP (0 - 100)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                    {classStudents.map((s, idx) => (
                      <tr key={s.NISN} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                        <td className="px-4 py-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-zinc-200">
                          {s['Nama Lengkap']}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={scores[s.NISN] ?? ''}
                            onChange={(e) => handleScoreChange(s.NISN, e.target.value)}
                            placeholder="0"
                            className="w-20 px-3 py-1 text-center font-bold text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl text-center">
                <Award className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">Silakan pilih TP di atas untuk mulai menginput nilai.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'kelola' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                Daftar TP Mapel: {selectedMapel} ({mapelTPs.length} TP)
              </h2>
              <Button variant="primary" size="sm" onClick={() => setIsAddTPOpen(true)}>
                <Plus className="w-4 h-4" /> Buat TP Baru
              </Button>
            </div>

            {mapelTPs.length > 0 ? (
              <div className="space-y-2">
                {mapelTPs.map((tp) => (
                  <div
                    key={tp.id}
                    className="p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl flex items-center justify-between gap-4 shadow-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] rounded">
                          {tp.kode_tp}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {tp.bab} • Semester {tp.semester}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 dark:text-zinc-200">{tp.deskripsi}</p>
                    </div>

                    <button
                      onClick={() => handleDeleteTP(tp.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800"
                      title="Hapus TP"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl text-center">
                <p className="text-xs text-slate-400 font-medium">Belum ada TP untuk mata pelajaran {selectedMapel}.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'induk' && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm p-6">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-500" /> Buku Induk Siswa & Rekap Capaian
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
              Menampilkan rekapitulasi nilai rata-rata per mata pelajaran untuk seluruh siswa kelas {activeKelas}.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200/80 dark:border-zinc-800 text-slate-500 font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3">Nama Siswa</th>
                    <th className="px-4 py-3">NISN</th>
                    <th className="px-4 py-3 text-center">Status Rapor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {classStudents.map((s) => (
                    <tr key={s.NISN} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-zinc-200">{s['Nama Lengkap']}</td>
                      <td className="px-4 py-3 font-mono text-slate-400">{s.NISN}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                          Lengkap
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Buat TP Baru */}
      <Modal isOpen={isAddTPOpen} onClose={() => setIsAddTPOpen(false)} title="Tambah Tujuan Pembelajaran (TP)">
        <form onSubmit={handleAddTP} className="space-y-4">
          <Input
            label="Kode TP"
            placeholder="Cth: TP 1.1 atau MAT-01"
            value={tpKode}
            onChange={(e) => setTpKode(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Bab / Materi</label>
              <select
                value={tpBab}
                onChange={(e) => setTpBab(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl"
              >
                {['Bab 1', 'Bab 2', 'Bab 3', 'Bab 4', 'Bab 5', 'Bab 6', 'Bab 7', 'Bab 8', 'Umum'].map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Semester</label>
              <select
                value={tpSemester}
                onChange={(e) => setTpSemester(e.target.value as '1' | '2')}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl"
              >
                <option value="1">Semester 1 (Ganjil)</option>
                <option value="2">Semester 2 (Genap)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Deskripsi Tujuan Pembelajaran</label>
            <textarea
              rows={3}
              placeholder="Cth: Peserta didik mampu memahami operasi penjumlahan bilangan cacah sampai 100..."
              value={tpDeskripsi}
              onChange={(e) => setTpDeskripsi(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddTPOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmittingTP}>
              Simpan TP Baru
            </Button>
          </div>
        </form>
      </Modal>
    </Shell>
  );
}
