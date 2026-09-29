'use client';

import React, { useState, useMemo } from 'react';
import { Shell } from '@/components/layout/Shell';
import { useAppStore } from '@/stores/app-store';
import { dbSet, dbRemove } from '@/lib/firebase/repository';
import { Note } from '@/types/note';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { getJakartaDateString } from '@/lib/utils/date';
import { FileText, Plus, Trash2, Calendar, User, Search, Filter } from 'lucide-react';

export default function NotesPage() {
  const { toast } = useToast();
  const activeKelas = useAppStore((state) => state.activeKelas);
  const academicYear = useAppStore((state) => state.academicYear);
  const studentsMap = useAppStore((state) => state.students);
  const notesMap = useAppStore((state) => state.catatan);

  const [filterSiswa, setFilterSiswa] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [selectedNisn, setSelectedNisn] = useState('');
  const [tanggal, setTanggal] = useState(getJakartaDateString());
  const [catatanTeks, setCatatanTeks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter students for active class
  const classStudents = useMemo(() => {
    return Object.values(studentsMap).filter((s) => s.Kelas === activeKelas);
  }, [studentsMap, activeKelas]);

  // Filter notes for active class
  const classNotes = useMemo(() => {
    return Object.entries(notesMap)
      .map(([id, note]) => ({ id, ...note }))
      .filter((n) => {
        const matchClass = n.Kelas === activeKelas;
        const matchStudent = filterSiswa === 'all' || n.NISN === filterSiswa;
        const q = searchQuery.toLowerCase().trim();
        const matchQuery = !q || n['Nama Lengkap'].toLowerCase().includes(q) || n.Catatan.toLowerCase().includes(q);
        return matchClass && matchStudent && matchQuery;
      })
      .sort((a, b) => new Date(b.Tanggal).getTime() - new Date(a.Tanggal).getTime());
  }, [notesMap, activeKelas, filterSiswa, searchQuery]);

  const handleSubmitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNisn) {
      toast('Silakan pilih siswa terlebih dahulu.', 'warning');
      return;
    }
    if (!catatanTeks.trim()) {
      toast('Catatan anekdotal tidak boleh kosong.', 'warning');
      return;
    }

    const student = studentsMap[selectedNisn] || classStudents.find((s) => s.NISN === selectedNisn);
    if (!student) {
      toast('Data siswa tidak ditemukan.', 'error');
      return;
    }

    setIsSubmitting(true);
    const noteId = `CAT_${Date.now()}_${selectedNisn}`;
    const payload: Note = {
      Tanggal: tanggal,
      NISN: selectedNisn,
      'Nama Lengkap': student['Nama Lengkap'],
      Catatan: catatanTeks.trim(),
      Kelas: activeKelas
    };

    const res = await dbSet<Note>(`Catatan/${noteId}`, payload, activeKelas, academicYear);
    setIsSubmitting(false);

    if (res.success) {
      toast('Catatan guru berhasil disimpan.', 'success');
      setCatatanTeks('');
      setSelectedNisn('');
    } else {
      toast(res.error || 'Gagal menyimpan catatan.', 'error');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Hapus permanen catatan observasi ini?')) return;
    const res = await dbRemove(`Catatan/${noteId}`, activeKelas, academicYear);
    if (res.success) {
      toast('Catatan berhasil dihapus.', 'success');
    } else {
      toast(res.error || 'Gagal menghapus catatan.', 'error');
    }
  };

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
            Catatan Guru & Jurnal Observasi - Kelas {activeKelas}
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Dokumentasi kejadian anekdotal, perkembangan karakter, dan tindak lanjut siswa.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Input Panel */}
          <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-sm h-fit">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Tambah Catatan Observasi</h2>
            </div>

            <form onSubmit={handleSubmitNote} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Pilih Siswa
                </label>
                <select
                  value={selectedNisn}
                  onChange={(e) => setSelectedNisn(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">-- Pilih Siswa Kelas {activeKelas} --</option>
                  {classStudents.map((s) => (
                    <option key={s.NISN} value={s.NISN}>
                      {s['Nama Lengkap']} ({s.NISN})
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Tanggal Kejadian"
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                required
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Deskripsi Observasi & Kejadian
                </label>
                <textarea
                  rows={4}
                  placeholder="Tuliskan catatan perilaku, kendala belajar, atau perkembangan positif siswa..."
                  value={catatanTeks}
                  onChange={(e) => setCatatanTeks(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <Button type="submit" variant="primary" className="w-full" size="sm" isLoading={isSubmitting}>
                Simpan Catatan Observasi
              </Button>
            </form>
          </div>

          {/* Records Stream Panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filter Bar */}
            <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari catatan atau nama siswa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={filterSiswa}
                  onChange={(e) => setFilterSiswa(e.target.value)}
                  className="w-full sm:w-48 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-xl"
                >
                  <option value="all">Semua Siswa</option>
                  {classStudents.map((s) => (
                    <option key={s.NISN} value={s.NISN}>
                      {s['Nama Lengkap']}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notes List */}
            {classNotes.length > 0 ? (
              <div className="space-y-3">
                {classNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                            {note['Nama Lengkap']}
                          </h3>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span className="flex items-center gap-1 font-mono">
                              <Calendar className="w-3 h-3" /> {note.Tanggal}
                            </span>
                            <span>•</span>
                            <span>NISN: {note.NISN}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                        title="Hapus Catatan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-zinc-300 mt-3 pl-11 whitespace-pre-wrap leading-relaxed">
                      {note.Catatan}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl text-center">
                <FileText className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">Belum ada catatan observasi untuk filter ini.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
