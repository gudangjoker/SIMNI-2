'use client';

import React, { useState, useMemo } from 'react';
import { Shell } from '@/components/layout/Shell';
import { useAppStore } from '@/stores/app-store';
import { dbSet, dbRemove, dbUpdate } from '@/lib/firebase/repository';
import { Student } from '@/types/student';
import { ClassId } from '@/types/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { 
  UserPlus, Search, CheckSquare, Square, Trash2, 
  Edit, Eye, User, Sparkles, AlertCircle 
} from 'lucide-react';

const CLASSES: ClassId[] = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B', 'PJOK'];

export default function StudentsPage() {
  const { toast } = useToast();
  const activeKelas = useAppStore((state) => state.activeKelas);
  const academicYear = useAppStore((state) => state.academicYear);
  const studentsMap = useAppStore((state) => state.students);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNisns, setSelectedNisns] = useState<string[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formNisn, setFormNisn] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formPanggilan, setFormPanggilan] = useState('');
  const [formKelas, setFormKelas] = useState<ClassId>(activeKelas);
  const [formKelompok, setFormKelompok] = useState('');
  const [formFotoUrl, setFormFotoUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Filter students based on active class and search
  const classStudents = useMemo(() => {
    return Object.values(studentsMap).filter((s) => {
      const matchClass = s.Kelas === activeKelas;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || 
        s['Nama Lengkap'].toLowerCase().includes(q) || 
        s.NISN.includes(q) ||
        (s.Panggilan && s.Panggilan.toLowerCase().includes(q));
      return matchClass && matchQuery;
    });
  }, [studentsMap, activeKelas, searchQuery]);

  const openAddModal = () => {
    setEditingStudent(null);
    setFormNisn('');
    setFormNama('');
    setFormPanggilan('');
    setFormKelas(activeKelas);
    setFormKelompok('');
    setFormFotoUrl('');
    setFormError(null);
    setIsAddEditOpen(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setFormNisn(student.NISN);
    setFormNama(student['Nama Lengkap']);
    setFormPanggilan(student.Panggilan || '');
    setFormKelas(student.Kelas);
    setFormKelompok(student.Kelompok || '');
    setFormFotoUrl(student.foto || '');
    setFormError(null);
    setIsAddEditOpen(true);
  };

  const openDetailModal = (student: Student) => {
    setSelectedStudent(student);
    setIsDetailOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanNisn = formNisn.trim();
    if (!/^\d{10}$/.test(cleanNisn)) {
      setFormError('NISN wajib terdiri dari tepat 10 digit angka numerik.');
      return;
    }

    if (!formNama.trim()) {
      setFormError('Nama lengkap siswa wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    const payload: Student = {
      ID_Siswa: editingStudent ? editingStudent.ID_Siswa : `SISWA_${cleanNisn}`,
      NISN: cleanNisn,
      'Nama Lengkap': formNama.trim(),
      Panggilan: formPanggilan.trim() || undefined,
      Kelas: formKelas,
      Kelompok: formKelompok.trim() || undefined,
      foto: formFotoUrl.trim() || undefined
    };

    const res = await dbSet<Student>(`Siswa/${cleanNisn}`, payload, formKelas, academicYear);
    setIsSubmitting(false);

    if (res.success) {
      toast(editingStudent ? 'Data siswa berhasil diperbarui.' : 'Siswa baru berhasil ditambahkan.', 'success');
      setIsAddEditOpen(false);
    } else {
      setFormError(res.error || 'Gagal menyimpan data ke database.');
    }
  };

  const handleDeleteSingle = async (student: Student) => {
    if (!window.confirm(`Hapus permanen data siswa: ${student['Nama Lengkap']} (${student.NISN})?`)) return;

    const res = await dbRemove(`Siswa/${student.NISN}`, student.Kelas, academicYear);
    if (res.success) {
      toast('Siswa berhasil dihapus dari sistem.', 'success');
      if (isDetailOpen) setIsDetailOpen(false);
    } else {
      toast(res.error || 'Gagal menghapus siswa.', 'error');
    }
  };

  // Batch actions
  const toggleSelectAll = () => {
    if (selectedNisns.length === classStudents.length) {
      setSelectedNisns([]);
    } else {
      setSelectedNisns(classStudents.map((s) => s.NISN));
    }
  };

  const toggleSelectStudent = (nisn: string) => {
    setSelectedNisns((prev) => 
      prev.includes(nisn) ? prev.filter((id) => id !== nisn) : [...prev, nisn]
    );
  };

  const handleBatchDelete = async () => {
    if (!selectedNisns.length) return;
    if (!window.confirm(`Hapus permanen ${selectedNisns.length} siswa yang dipilih?`)) return;

    const updates: Record<string, null> = {};
    selectedNisns.forEach((nisn) => {
      updates[`Siswa/${nisn}`] = null;
    });

    const res = await dbUpdate(updates, activeKelas, academicYear);
    if (res.success) {
      toast(`${selectedNisns.length} siswa berhasil dihapus.`, 'success');
      setSelectedNisns([]);
      setIsBatchMode(false);
    } else {
      toast(res.error || 'Gagal menghapus batch siswa.', 'error');
    }
  };

  return (
    <Shell>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Buku Data Siswa - Kelas {activeKelas}
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Total {classStudents.length} siswa terdaftar pada tahun ajaran {academicYear}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isBatchMode ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => {
                setIsBatchMode(!isBatchMode);
                setSelectedNisns([]);
              }}
            >
              <CheckSquare className="w-4 h-4" />
              {isBatchMode ? 'Batal Pilih' : 'Pilih Massal'}
            </Button>
            <Button variant="primary" size="sm" onClick={openAddModal}>
              <UserPlus className="w-4 h-4" /> Tambah Siswa
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama, NISN, atau nama panggilan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Floating Batch Action Bar */}
        {isBatchMode && (
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl flex items-center justify-between animate-in slide-in-from-bottom duration-150">
            <div className="flex items-center gap-3">
              <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-xs font-semibold">
                {selectedNisns.length === classStudents.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                Pilih Semua ({selectedNisns.length}/{classStudents.length})
              </button>
            </div>
            {selectedNisns.length > 0 && (
              <Button variant="danger" size="sm" onClick={handleBatchDelete}>
                <Trash2 className="w-3.5 h-3.5" /> Hapus Terpilih
              </Button>
            )}
          </div>
        )}

        {/* Student Cards Grid */}
        {classStudents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {classStudents.map((student) => {
              const isSelected = selectedNisns.includes(student.NISN);
              return (
                <div
                  key={student.NISN}
                  className={`relative p-4 bg-white dark:bg-zinc-900 border rounded-2xl shadow-sm transition-all duration-150 ${
                    isSelected ? 'border-indigo-600 ring-2 ring-indigo-500/20' : 'border-slate-200/80 dark:border-zinc-800 hover:border-slate-300'
                  }`}
                >
                  {isBatchMode && (
                    <button
                      onClick={() => toggleSelectStudent(student.NISN)}
                      className="absolute top-3 right-3 text-slate-400 hover:text-indigo-600"
                    >
                      {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                    </button>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200/60 dark:border-zinc-700">
                      {student.foto ? (
                        <img src={student.foto} alt={student['Nama Lengkap']} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-slate-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pr-6">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                        {student['Nama Lengkap']}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">NISN: {student.NISN}</p>
                      {student.Kelompok && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded mt-1">
                          <Sparkles className="w-2.5 h-2.5" /> {student.Kelompok}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/80">
                    <button
                      onClick={() => openDetailModal(student)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                      title="Lihat Profil"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openEditModal(student)}
                      className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                      title="Ubah Data"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSingle(student)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl text-center">
            <p className="text-xs text-slate-400 font-medium">Tidak ada data siswa yang cocok dengan filter aktif.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Student Modal */}
      <Modal
        isOpen={isAddEditOpen}
        onClose={() => setIsAddEditOpen(false)}
        title={editingStudent ? 'Perbarui Data Siswa' : 'Tambah Siswa Baru'}
        description={`Pendaftaran pada Kelas ${formKelas}`}
      >
        <form onSubmit={handleSaveStudent} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <Input
            label="Nomor Induk Siswa Nasional (NISN)"
            placeholder="Tepat 10 digit angka (cth: 0123456789)"
            value={formNisn}
            onChange={(e) => setFormNisn(e.target.value)}
            disabled={!!editingStudent}
            required
          />

          <Input
            label="Nama Lengkap Siswa"
            placeholder="Sesuai akta kelahiran"
            value={formNama}
            onChange={(e) => setFormNama(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nama Panggilan"
              placeholder="Panggilan akrab"
              value={formPanggilan}
              onChange={(e) => setFormPanggilan(e.target.value)}
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Kelas</label>
              <select
                value={formKelas}
                onChange={(e) => setFormKelas(e.target.value as ClassId)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl"
              >
                {CLASSES.map((c) => (
                  <option key={c} value={c}>
                    Kelas {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label="Kelompok Rombel BTQ (Opsional)"
            placeholder="Cth: Kelompok Abu Bakar"
            value={formKelompok}
            onChange={(e) => setFormKelompok(e.target.value)}
          />

          <Input
            label="URL Foto Siswa (Cloudinary HTTPS)"
            placeholder="https://res.cloudinary.com/..."
            value={formFotoUrl}
            onChange={(e) => setFormFotoUrl(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddEditOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Simpan Data Siswa
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Profile Modal */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Biodata Siswa"
      >
        {selectedStudent && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl">
              <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-zinc-700 overflow-hidden flex items-center justify-center shrink-0">
                {selectedStudent.foto ? (
                  <img src={selectedStudent.foto} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{selectedStudent['Nama Lengkap']}</h3>
                <p className="text-xs text-slate-400 font-mono">NISN: {selectedStudent.NISN}</p>
                <span className="inline-block px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold rounded mt-1">
                  Kelas {selectedStudent.Kelas}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-slate-400">Nama Panggilan:</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{selectedStudent.Panggilan || '-'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-slate-400">Rombel BTQ:</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{selectedStudent.Kelompok || '-'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">ID Registrasi:</span>
                <span className="font-mono text-slate-600 dark:text-zinc-400">{selectedStudent.ID_Siswa}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
              <Button variant="danger" size="sm" onClick={() => handleDeleteSingle(selectedStudent)}>
                Hapus Siswa
              </Button>
              <Button variant="primary" size="sm" onClick={() => { setIsDetailOpen(false); openEditModal(selectedStudent); }}>
                Ubah Profil
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Shell>
  );
}
