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
  Edit, Eye, User, Sparkles, AlertCircle, QrCode,
  FileDown, Upload, Download, CheckCircle, AlertTriangle, Layers
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  generateStudentTemplate,
  exportStudentsToExcel,
  parseStudentExcelFile
} from '@/lib/excel/student-excel';

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
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Excel Features State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateMode, setTemplateMode] = useState<'single' | 'all'>('single');
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [parsedStudents, setParsedStudents] = useState<Student[]>([]);
  const [importErrors, setImportErrors] = useState<{ row: number; sheet: string; message: string }[]>([]);
  const [isSavingImport, setIsSavingImport] = useState(false);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState<'single' | 'all'>('single');
  const [isExporting, setIsExporting] = useState(false);

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

  const openDetailModal = async (student: Student) => {
    setSelectedStudent(student);
    setIsDetailOpen(true);
    try {
      const url = await QRCode.toDataURL(student.NISN, { width: 250, margin: 1 });
      setQrCodeUrl(url);
    } catch {
      setQrCodeUrl(null);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanNisn = formNisn.trim();
    if (!/^\d{10}$/.test(cleanNisn)) {
      setFormError('NISN wajib terdiri tepat dari 10 digit angka numerik.');
      return;
    }

    if (!formNama.trim()) {
      setFormError('Nama lengkap siswa tidak boleh kosong.');
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

  // 1. Download Template Excel Siswa
  const handleDownloadTemplate = async () => {
    try {
      setIsGeneratingTemplate(true);
      const blob = await generateStudentTemplate({
        mode: templateMode,
        classId: activeKelas,
        academicYear
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = templateMode === 'single'
        ? `Template_Siswa_Kelas_${activeKelas}.xlsx`
        : `Template_Siswa_Semua_Kelas_${academicYear.replace('/', '-')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsTemplateModalOpen(false);
      toast('Template Excel data siswa berhasil diunduh.', 'success');
    } catch (err) {
      console.error(err);
      toast('Gagal mengunduh template Excel siswa.', 'error');
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  // 2. Ekspor Siswa ke Excel
  const handleExportStudents = async () => {
    try {
      setIsExporting(true);
      const allStudents = Object.values(studentsMap);
      const blob = await exportStudentsToExcel({
        students: allStudents,
        classId: activeKelas,
        academicYear,
        mode: exportMode
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportMode === 'single'
        ? `Daftar_Siswa_Kelas_${activeKelas}.xlsx`
        : `Daftar_Siswa_Semua_Kelas_${academicYear.replace('/', '-')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsExportModalOpen(false);
      toast('Daftar siswa berhasil diekspor ke file Excel profesional.', 'success');
    } catch (err) {
      console.error(err);
      toast('Gagal mengekspor data siswa ke Excel.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Impor File Excel Siswa
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsParsingExcel(true);
      const result = await parseStudentExcelFile(file, activeKelas);
      setParsedStudents(result.validStudents);
      setImportErrors(result.errors);
      if (result.validStudents.length === 0 && result.errors.length > 0) {
        toast(`Ditemukan ${result.errors.length} masalah format pada file Excel.`, 'warning');
      } else {
        toast(`${result.validStudents.length} siswa berhasil dibaca dari file Excel.`, 'success');
      }
    } catch (err) {
      console.error(err);
      toast('Gagal membaca file Excel. Pastikan file berformat .xlsx yang valid.', 'error');
    } finally {
      setIsParsingExcel(false);
      e.target.value = '';
    }
  };

  // 4. Konfirmasi Simpan Siswa Hasil Impor
  const handleSaveImportedStudents = async () => {
    if (parsedStudents.length === 0) return;
    setIsSavingImport(true);

    try {
      let savedCount = 0;
      for (const st of parsedStudents) {
        await dbSet<Student>(`Siswa/${st.NISN}`, st, st.Kelas, academicYear);
        savedCount++;
      }
      toast(`Berhasil mengimpor ${savedCount} data siswa ke database.`, 'success');
      setIsImportModalOpen(false);
      setParsedStudents([]);
      setImportErrors([]);
    } catch (err) {
      console.error(err);
      toast('Terjadi kendala saat menyimpan data siswa yang diimpor.', 'error');
    } finally {
      setIsSavingImport(false);
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

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTemplateModalOpen(true)}
              title="Unduh template Excel bergaris tabel & header rapi"
            >
              <FileDown className="w-3.5 h-3.5 mr-1" /> Template Excel
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              title="Impor data siswa dari file spreadsheet Excel"
            >
              <Upload className="w-3.5 h-3.5 mr-1" /> Impor Siswa
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExportModalOpen(true)}
              title="Ekspor daftar siswa ke file Excel profesional"
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Ekspor Siswa
            </Button>

            <Button
              variant={isBatchMode ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => {
                setIsBatchMode(!isBatchMode);
                setSelectedNisns([]);
              }}
            >
              <CheckSquare className="w-3.5 h-3.5 mr-1" />
              {isBatchMode ? 'Batal Pilih' : 'Pilih Massal'}
            </Button>

            <Button variant="primary" size="sm" onClick={openAddModal}>
              <UserPlus className="w-3.5 h-3.5 mr-1" /> Tambah Siswa
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
              <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classStudents.map((student) => {
              const isSelected = selectedNisns.includes(student.NISN);
              return (
                <div
                  key={student.NISN}
                  className={`p-4 bg-white dark:bg-zinc-900 border rounded-2xl transition-all shadow-sm flex flex-col justify-between ${
                    isSelected 
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
                      : 'border-slate-200/80 dark:border-zinc-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {isBatchMode && (
                      <button
                        onClick={() => toggleSelectStudent(student.NISN)}
                        className="mt-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                      </button>
                    )}

                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-zinc-700">
                      {student.foto ? (
                        <img src={student.foto} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-slate-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-mono text-slate-400 font-semibold">{student.NISN}</span>
                        {student.Kelompok && (
                          <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-[9px] font-bold rounded">
                            BTQ: {student.Kelompok}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate mt-0.5">
                        {student['Nama Lengkap']}
                      </h3>
                      {student.Panggilan && (
                        <p className="text-[11px] text-slate-400 truncate">({student.Panggilan})</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/80">
                    <Button variant="ghost" size="sm" onClick={() => openDetailModal(student)} title="Kartu Pelajar & QR Presensi">
                      <QrCode className="w-3.5 h-3.5 mr-1 text-indigo-500" /> Kartu QR
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(student)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteSingle(student)}>
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8">
            <User className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Belum Ada Data Siswa</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Tidak ditemukan data siswa untuk kelas {activeKelas}. Tambahkan siswa secara manual atau gunakan tombol <strong>Impor Siswa</strong> via Excel.
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(true)}>
                <Upload className="w-4 h-4 mr-1.5" /> Impor Excel
              </Button>
              <Button variant="primary" size="sm" onClick={openAddModal}>
                <UserPlus className="w-4 h-4 mr-1.5" /> Tambah Siswa Baru
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Unduh Template Excel Siswa */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="Unduh Template Excel Data Siswa"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Pilih cakupan template Excel yang Anda butuhkan. File Excel diformat profesional lengkap dengan garis kisi tabel, header warna indigo resmi, dan baris contoh isian.
          </p>

          <div className="space-y-2.5">
            <label
              onClick={() => setTemplateMode('single')}
              className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                templateMode === 'single'
                  ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200'
                  : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
              }`}
            >
              <input
                type="radio"
                name="studentTemplateMode"
                checked={templateMode === 'single'}
                onChange={() => setTemplateMode('single')}
                className="mt-1 text-indigo-600"
              />
              <div>
                <p className="text-xs font-bold">Template 1 Kelas Saja (Kelas {activeKelas})</p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Berisi 1 sheet khusus untuk pengisian siswa rombel {activeKelas}.
                </p>
              </div>
            </label>

            <label
              onClick={() => setTemplateMode('all')}
              className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                templateMode === 'all'
                  ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200'
                  : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
              }`}
            >
              <input
                type="radio"
                name="studentTemplateMode"
                checked={templateMode === 'all'}
                onChange={() => setTemplateMode('all')}
                className="mt-1 text-indigo-600"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold">Template Banyak Kelas (12 Sheet Rombel)</p>
                  <span className="text-[9px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold">
                    Multi-Sheet
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Berisi 12 sheet terpisah per kelas (1A, 1B s/d 6B) untuk pendataan satu sekolah sekaligus.
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <Button variant="ghost" size="sm" onClick={() => setIsTemplateModalOpen(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownloadTemplate}
              isLoading={isGeneratingTemplate}
            >
              <FileDown className="w-4 h-4 mr-1.5" /> Unduh Template .xlsx
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Ekspor Daftar Siswa ke Excel */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Ekspor Daftar Siswa ke Excel"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Pilih cakupan data siswa yang ingin diekspor ke dalam file spreadsheet Excel resmi dengan tata letak profesional.
          </p>

          <div className="space-y-2.5">
            <label
              onClick={() => setExportMode('single')}
              className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                exportMode === 'single'
                  ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200'
                  : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
              }`}
            >
              <input
                type="radio"
                name="studentExportMode"
                checked={exportMode === 'single'}
                onChange={() => setExportMode('single')}
                className="mt-1 text-indigo-600"
              />
              <div>
                <p className="text-xs font-bold">Ekspor Siswa Kelas {activeKelas} Saja</p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Mengekspor {classStudents.length} siswa pada rombel kelas yang sedang aktif.
                </p>
              </div>
            </label>

            <label
              onClick={() => setExportMode('all')}
              className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                exportMode === 'all'
                  ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200'
                  : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
              }`}
            >
              <input
                type="radio"
                name="studentExportMode"
                checked={exportMode === 'all'}
                onChange={() => setExportMode('all')}
                className="mt-1 text-indigo-600"
              />
              <div>
                <p className="text-xs font-bold">Ekspor Semua Siswa (Per Rombel Per Sheet)</p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Mengekspor seluruh data siswa sekolah yang dipisah ke masing-masing sheet per rombel.
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <Button variant="ghost" size="sm" onClick={() => setIsExportModalOpen(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportStudents}
              isLoading={isExporting}
            >
              <Download className="w-4 h-4 mr-1.5" /> Ekspor ke Excel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal 3: Impor Siswa dari File Excel */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setParsedStudents([]);
          setImportErrors([]);
        }}
        title="Impor Data Siswa dari File Excel"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Unggah file Excel (.xlsx) yang telah diisi. Sistem akan membaca seluruh baris siswa, memvalidasi NISN 10 digit, dan memetakan rombel kelas (termasuk file dengan banyak sheet).
          </p>

          {/* Area Unggah File */}
          <div className="p-5 border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/50 text-center">
            <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Pilih file spreadsheet siswa (.xlsx)</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Bisa berupa template 1 kelas atau template multi-sheet</p>
            <input
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              disabled={isParsingExcel}
              className="mt-3 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
            />
          </div>

          {/* Error List jika ada baris tidak valid */}
          {importErrors.length > 0 && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs text-rose-700 dark:text-rose-300 space-y-1 max-h-32 overflow-y-auto">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" /> Ditemukan {importErrors.length} baris tidak lengkap/salah:
              </p>
              {importErrors.map((err, idx) => (
                <p key={idx} className="text-[11px] pl-5">
                  • [Sheet {err.sheet}] Baris {err.row}: {err.message}
                </p>
              ))}
            </div>
          )}

          {/* Tabel Pratinjau Profesional */}
          {parsedStudents.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-zinc-300">
                <span>Pratinjau Data Siswa Valid ({parsedStudents.length} siswa):</span>
              </div>
              <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-semibold sticky top-0">
                    <tr>
                      <th className="px-3 py-2 border-r border-slate-200 dark:border-zinc-700">No</th>
                      <th className="px-3 py-2 border-r border-slate-200 dark:border-zinc-700">NISN</th>
                      <th className="px-3 py-2 border-r border-slate-200 dark:border-zinc-700">Nama Lengkap</th>
                      <th className="px-3 py-2 border-r border-slate-200 dark:border-zinc-700">Panggilan</th>
                      <th className="px-3 py-2 border-r border-slate-200 dark:border-zinc-700 text-center">Kelas</th>
                      <th className="px-3 py-2">BTQ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {parsedStudents.map((st, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td className="px-3 py-1.5 font-mono text-slate-400 border-r border-slate-200 dark:border-zinc-800">{idx + 1}</td>
                        <td className="px-3 py-1.5 font-mono font-bold text-indigo-600 border-r border-slate-200 dark:border-zinc-800">{st.NISN}</td>
                        <td className="px-3 py-1.5 font-semibold border-r border-slate-200 dark:border-zinc-800">{st['Nama Lengkap']}</td>
                        <td className="px-3 py-1.5 text-slate-500 border-r border-slate-200 dark:border-zinc-800">{st.Panggilan || '-'}</td>
                        <td className="px-3 py-1.5 text-center font-bold border-r border-slate-200 dark:border-zinc-800">
                          <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 text-[10px] rounded">
                            {st.Kelas}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-slate-500">{st.Kelompok || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsImportModalOpen(false);
                setParsedStudents([]);
                setImportErrors([]);
              }}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveImportedStudents}
              disabled={parsedStudents.length === 0}
              isLoading={isSavingImport}
            >
              <CheckCircle className="w-4 h-4 mr-1.5" /> Konfirmasi Simpan {parsedStudents.length} Siswa
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal 4: Tambah/Edit Siswa Manual */}
      <Modal
        isOpen={isAddEditOpen}
        onClose={() => setIsAddEditOpen(false)}
        title={editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <Input
            label="NISN (Nomor Induk Siswa Nasional)"
            placeholder="10 digit angka (cth: 0081234567)"
            value={formNisn}
            onChange={(e) => setFormNisn(e.target.value)}
            disabled={!!editingStudent}
            required
          />

          <Input
            label="Nama Lengkap Siswa"
            placeholder="Cth: Muhammad Bilal Al-Farisi"
            value={formNama}
            onChange={(e) => setFormNama(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nama Panggilan"
              placeholder="Cth: Bilal"
              value={formPanggilan}
              onChange={(e) => setFormPanggilan(e.target.value)}
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Penugasan Kelas</label>
              <select
                value={formKelas}
                onChange={(e) => setFormKelas(e.target.value as ClassId)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500"
              >
                {CLASSES.map((c) => (
                  <option key={c} value={c}>
                    Kelas {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Rombel / Kelompok BTQ"
              placeholder="Cth: Tahsin A / Tilawati 2"
              value={formKelompok}
              onChange={(e) => setFormKelompok(e.target.value)}
            />

            <Input
              label="Foto Profil Siswa (URL)"
              placeholder="https://..."
              value={formFotoUrl}
              onChange={(e) => setFormFotoUrl(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddEditOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Simpan Data Siswa
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 5: Detail Profile & QR Siswa */}
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

            {/* Kartu QR Code Identitas Siswa */}
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-white dark:from-zinc-800 dark:to-zinc-900 border border-indigo-100 dark:border-zinc-700 rounded-2xl flex items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-indigo-600" /> QR Code Presensi Siswa
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">Dicetak pada kartu siswa untuk presensi harian otomatis tanpa kontak fisik.</p>
              </div>
              {qrCodeUrl && (
                <div className="shrink-0 p-1.5 bg-white border rounded-xl shadow-md">
                  <img src={qrCodeUrl} alt="QR NISN" className="w-20 h-20" />
                </div>
              )}
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
