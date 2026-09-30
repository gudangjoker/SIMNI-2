'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Shell } from '@/components/layout/Shell';
import { useAppStore } from '@/stores/app-store';
import { dbSet, dbUpdate, dbRemove } from '@/lib/firebase/repository';
import { LearningObjective, Grade } from '@/types/grade';
import { ClassId } from '@/types/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  Award,
  Plus,
  Trash2,
  BookOpen,
  Save,
  FileSpreadsheet,
  User,
  FileDown,
  Upload,
  Download,
  CheckCircle,
  AlertTriangle,
  Layers
} from 'lucide-react';
import {
  getSubjectsForClass,
  BAB_OPTIONS,
  SPECIALIST_MAPEL_LIST
} from '@/lib/constants/subjects';
import {
  generateTPTemplate,
  exportTPToExcel,
  parseTPExcelFile,
  ParsedTPRecord
} from '@/lib/excel/tp-excel';
import { exportGradeBookToExcel } from '@/lib/excel/reports-excel';

export default function GradesPage() {
  const { toast } = useToast();
  const activeKelas = useAppStore((state) => state.activeKelas);
  const academicYear = useAppStore((state) => state.academicYear);
  const studentsMap = useAppStore((state) => state.students);
  const mapelTPMap = useAppStore((state) => state.mapelTP);
  const nilaiTPMap = useAppStore((state) => state.nilaiTP);

  const [activeTab, setActiveTab] = useState<'input' | 'kelola' | 'induk'>('input');

  // Daftar mapel dinamis sesuai jenjang kelas aktif (Bahasa Arab otomatis tersembunyi di kelas 1-3)
  const availableMapels = useMemo(() => getSubjectsForClass(activeKelas), [activeKelas]);

  // Input Nilai State
  const [selectedMapel, setSelectedMapel] = useState(availableMapels[0]);
  const [selectedTPId, setSelectedTPId] = useState<string>('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [isSavingScores, setIsSavingScores] = useState(false);

  // Sync selectedMapel jika kelas berganti dan mapel lama tidak tersedia di kelas baru
  useEffect(() => {
    if (!availableMapels.includes(selectedMapel)) {
      setSelectedMapel(availableMapels[0] || 'Pendidikan Agama Islam');
    }
  }, [availableMapels, selectedMapel]);

  // Kelola TP State
  const [isAddTPOpen, setIsAddTPOpen] = useState(false);
  const [tpKode, setTpKode] = useState('');
  const [tpBab, setTpBab] = useState(BAB_OPTIONS[0]);
  const [tpSemester, setTpSemester] = useState<'1' | '2'>('1');
  const [tpDeskripsi, setTpDeskripsi] = useState('');
  const [isSubmittingTP, setIsSubmittingTP] = useState(false);

  // Excel TP Template & Import State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateMode, setTemplateMode] = useState<'single' | 'specialist'>('single');
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [parsedTPs, setParsedTPs] = useState<ParsedTPRecord[]>([]);
  const [importErrors, setImportErrors] = useState<{ row: number; sheet: string; message: string }[]>([]);
  const [isSavingImport, setIsSavingImport] = useState(false);

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
  useEffect(() => {
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
    } else {
      toast(res.error || 'Gagal menambahkan TP.', 'error');
    }
  };

  const handleDeleteTP = async (tpId: string) => {
    if (!window.confirm('Yakin ingin menghapus Tujuan Pembelajaran ini? Nilai terkait akan terdampak.')) return;
    const res = await dbRemove(`Mapel_TP/${tpId}`, activeKelas, academicYear);
    if (res.success) {
      toast('TP berhasil dihapus.', 'info');
      if (selectedTPId === tpId) setSelectedTPId('');
    } else {
      toast(res.error || 'Gagal menghapus TP.', 'error');
    }
  };

  // Download Template TP Excel
  const handleDownloadTemplate = async () => {
    try {
      setIsGeneratingTemplate(true);
      const blob = await generateTPTemplate({
        mode: templateMode,
        classId: activeKelas,
        academicYear,
        specificMapel: selectedMapel
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = templateMode === 'single'
        ? `Template_TP_Kelas_${activeKelas}_${selectedMapel.replace(/\s+/g, '_')}.xlsx`
        : `Template_TP_MultiKelas_Spesialis.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsTemplateModalOpen(false);
      toast('Template Excel Tujuan Pembelajaran berhasil diunduh.', 'success');
    } catch (err) {
      console.error(err);
      toast('Gagal mengunduh template TP.', 'error');
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  // Ekspor TP yang Ada
  const handleExportCurrentTP = async () => {
    if (mapelTPs.length === 0) {
      toast(`Belum ada TP untuk mapel ${selectedMapel} yang dapat diekspor.`, 'warning');
      return;
    }
    try {
      const blob = await exportTPToExcel({
        tps: mapelTPs,
        classId: activeKelas,
        academicYear,
        mapel: selectedMapel
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Daftar_TP_${selectedMapel.replace(/\s+/g, '_')}_Kelas_${activeKelas}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Daftar TP berhasil diekspor ke Excel.', 'success');
    } catch (err) {
      console.error(err);
      toast('Gagal mengekspor TP.', 'error');
    }
  };

  const [isExportingGradeBook, setIsExportingGradeBook] = useState(false);

  const handleExportGradeBook = async () => {
    try {
      setIsExportingGradeBook(true);
      const blob = await exportGradeBookToExcel({
        students: classStudents,
        grades: nilaiTPMap,
        activeKelas,
        academicYear,
        mapelList: availableMapels
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Buku_Induk_Nilai_Kelas_${activeKelas}_${academicYear.replace('/', '-')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Buku Induk Nilai berhasil diekspor ke Excel profesional.', 'success');
    } catch (err) {
      console.error(err);
      toast('Gagal mengekspor Buku Induk Nilai.', 'error');
    } finally {
      setIsExportingGradeBook(false);
    }
  };

  // Handle Pilih File Impor TP
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsParsingExcel(true);
      const result = await parseTPExcelFile(file, activeKelas);
      setParsedTPs(result.validTPs);
      setImportErrors(result.errors);
      if (result.validTPs.length === 0 && result.errors.length > 0) {
        toast(`Ditemukan ${result.errors.length} masalah format pada file Excel.`, 'warning');
      } else {
        toast(`${result.validTPs.length} entri TP siap diimpor.`, 'success');
      }
    } catch (err) {
      console.error(err);
      toast('Gagal membaca file Excel. Pastikan format file sesuai.', 'error');
    } finally {
      setIsParsingExcel(false);
      e.target.value = '';
    }
  };

  // Simpan TP yang Diimpor ke Database
  const handleSaveImportedTP = async () => {
    if (parsedTPs.length === 0) return;
    setIsSavingImport(true);

    try {
      let savedCount = 0;
      for (const item of parsedTPs) {
        const tpId = `TP_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const payload: LearningObjective = {
          ID_mapel: tpId,
          kode_tp: item.kode_tp,
          mapel: item.mapel,
          bab: item.bab,
          semester: item.semester,
          deskripsi: item.deskripsi
        };

        // Simpan ke setiap kelas target (khusus spesialis PJOK / B. Inggris / PAI yang multi-kelas)
        for (const targetClass of item.targetClasses) {
          await dbSet<LearningObjective>(`Mapel_TP/${tpId}`, payload, targetClass, academicYear);
        }
        savedCount++;
      }

      toast(`Berhasil mengimpor ${savedCount} Tujuan Pembelajaran ke database.`, 'success');
      setIsImportModalOpen(false);
      setParsedTPs([]);
      setImportErrors([]);
    } catch (err) {
      console.error(err);
      toast('Terjadi kendala saat menyimpan TP ke database.', 'error');
    } finally {
      setIsSavingImport(false);
    }
  };

  return (
    <Shell>
      <div className="space-y-6">
        {/* Header Modul */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-500" /> Penilaian & Tujuan Pembelajaran (TP)
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Kelola TP, input nilai sumatif/formatif Kurikulum Merdeka, dan ekspor buku induk kelas {activeKelas}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('input')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'input'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              Input Nilai
            </button>
            <button
              onClick={() => setActiveTab('kelola')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'kelola'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              Kelola TP
            </button>
            <button
              onClick={() => setActiveTab('induk')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'induk'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              Buku Induk
            </button>
          </div>
        </div>

        {/* Tab 1: Input Nilai TP */}
        {activeTab === 'input' && (
          <div className="space-y-4">
            <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Selector Mata Pelajaran Dinamis */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mata Pelajaran</label>
                  <select
                    value={selectedMapel}
                    onChange={(e) => {
                      setSelectedMapel(e.target.value);
                      setSelectedTPId('');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-800 dark:text-zinc-200"
                  >
                    {availableMapels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Selector Tujuan Pembelajaran */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tujuan Pembelajaran (TP)</label>
                  <select
                    value={selectedTPId}
                    onChange={(e) => setSelectedTPId(e.target.value)}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-800 dark:text-zinc-200 max-w-xs md:max-w-md truncate"
                  >
                    <option value="">-- Pilih Tujuan Pembelajaran --</option>
                    {mapelTPs.map((tp) => (
                      <option key={tp.id} value={tp.id}>
                        {tp.kode_tp} - {tp.deskripsi}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedTPId && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveScores}
                  isLoading={isSavingScores}
                  className="shrink-0"
                >
                  <Save className="w-4 h-4 mr-1.5" /> Simpan Semua Nilai
                </Button>
              )}
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

        {/* Tab 2: Kelola Tujuan Pembelajaran (TP) */}
        {activeTab === 'kelola' && (
          <div className="space-y-4">
            <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mata Pelajaran Aktif</label>
                <select
                  value={selectedMapel}
                  onChange={(e) => setSelectedMapel(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-800 dark:text-zinc-200"
                >
                  {availableMapels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Action Toolbar Kelola TP */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTemplateModalOpen(true)}
                  title="Unduh format template Excel dengan dropdown validation"
                >
                  <FileDown className="w-3.5 h-3.5 mr-1" /> Template TP (Excel)
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsImportModalOpen(true)}
                  title="Impor daftar TP dari file Excel"
                >
                  <Upload className="w-3.5 h-3.5 mr-1" /> Impor TP
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCurrentTP}
                  title="Ekspor TP mapel ini ke Excel"
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Ekspor TP
                </Button>

                <Button variant="primary" size="sm" onClick={() => setIsAddTPOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Buat TP Baru
                </Button>
              </div>
            </div>

            {/* List Tujuan Pembelajaran */}
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
                        <span className="text-[10px] text-slate-400 font-medium">
                          {tp.bab} • Semester {tp.semester}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 dark:text-zinc-200">{tp.deskripsi}</p>
                    </div>

                    <button
                      onClick={() => handleDeleteTP(tp.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                      title="Hapus TP"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl text-center">
                <BookOpen className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">
                  Belum ada TP untuk mata pelajaran {selectedMapel} di kelas {activeKelas}.
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Gunakan tombol <strong>Impor TP</strong> atau <strong>Buat TP Baru</strong> untuk mengisi tujuan pembelajaran.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Rekap Buku Induk */}
        {activeTab === 'induk' && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-500" /> Buku Induk Siswa & Rekap Capaian
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Menampilkan rekapitulasi nilai rata-rata per mata pelajaran untuk seluruh siswa kelas {activeKelas}.
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleExportGradeBook}
                isLoading={isExportingGradeBook}
                className="shrink-0"
              >
                <Download className="w-4 h-4 mr-1.5" /> Ekspor Buku Induk (Excel)
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <thead className="bg-slate-50 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 uppercase font-semibold">
                  <tr>
                    <th className="px-3 py-2 border-r border-slate-200 dark:border-zinc-800 w-10 text-center">No</th>
                    <th className="px-3 py-2 border-r border-slate-200 dark:border-zinc-800 w-24">NISN</th>
                    <th className="px-3 py-2 border-r border-slate-200 dark:border-zinc-800">Nama Siswa</th>
                    {availableMapels.map((m) => (
                      <th key={m} className="px-2 py-2 border-r border-slate-200 dark:border-zinc-800 text-center text-[10px]">
                        {m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                  {classStudents.map((s, idx) => (
                    <tr key={s.NISN} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-3 py-2 text-center text-slate-400 font-mono border-r border-slate-200 dark:border-zinc-800">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono text-slate-500 border-r border-slate-200 dark:border-zinc-800">{s.NISN}</td>
                      <td className="px-3 py-2 font-semibold text-slate-800 dark:text-zinc-200 border-r border-slate-200 dark:border-zinc-800">
                        {s['Nama Lengkap']}
                      </td>
                      {availableMapels.map((m) => (
                        <td key={m} className="px-2 py-2 text-center font-bold font-mono text-indigo-600 dark:text-indigo-400 border-r border-slate-200 dark:border-zinc-800">
                          -
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Unduh Template Excel TP */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="Unduh Template Excel Tujuan Pembelajaran"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Pilih model template Excel sesuai kebutuhan pengisian TP. File Excel dilengkapi garis tabel resmi dan <strong>Dropdown List Data Validation</strong> pada kolom Mata Pelajaran dan Bab.
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
                name="tpTemplateMode"
                checked={templateMode === 'single'}
                onChange={() => setTemplateMode('single')}
                className="mt-1 text-indigo-600"
              />
              <div>
                <p className="text-xs font-bold">Template Kelas Tunggal (Kelas {activeKelas})</p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Dikhususkan untuk Guru Kelas dalam menginput TP untuk rombel {activeKelas}.
                </p>
              </div>
            </label>

            <label
              onClick={() => setTemplateMode('specialist')}
              className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                templateMode === 'specialist'
                  ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200'
                  : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
              }`}
            >
              <input
                type="radio"
                name="tpTemplateMode"
                checked={templateMode === 'specialist'}
                onChange={() => setTemplateMode('specialist')}
                className="mt-1 text-indigo-600"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold">Template Multi-Kelas (Guru Bidang Studi)</p>
                  <span className="text-[9px] bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold">
                    PJOK, B. Inggris, PAI
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Dilengkapi kolom Target Kelas sehingga satu baris TP dapat langsung didistribusikan ke banyak kelas (misal: 1A, 1B, 2A atau SEMUA).
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

      {/* Modal 2: Impor TP dari Excel */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setParsedTPs([]);
          setImportErrors([]);
        }}
        title="Impor Tujuan Pembelajaran dari File Excel"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Unggah file spreadsheet template TP yang telah diisi. Sistem akan membaca kode TP, semester, bab, deskripsi, dan target kelas rombel secara otomatis.
          </p>

          {/* Upload Area */}
          <div className="p-5 border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/50 text-center">
            <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Pilih file template TP (.xlsx)</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Format file harus sesuai dengan template SIMNI</p>
            <input
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              disabled={isParsingExcel}
              className="mt-3 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
            />
          </div>

          {/* Validasi Masalah Format */}
          {importErrors.length > 0 && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs text-rose-700 dark:text-rose-300 space-y-1 max-h-32 overflow-y-auto">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" /> Ditemukan {importErrors.length} baris tidak lengkap:
              </p>
              {importErrors.map((err, idx) => (
                <p key={idx} className="text-[11px] pl-5">
                  • [Sheet {err.sheet}] Baris {err.row}: {err.message}
                </p>
              ))}
            </div>
          )}

          {/* Preview Tabel TP yang Siap Diimpor */}
          {parsedTPs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-zinc-300">
                <span>Pratinjau Data TP Siap Simpan ({parsedTPs.length} entri):</span>
              </div>
              <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-semibold sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Kode</th>
                      <th className="px-3 py-2">Mapel</th>
                      <th className="px-3 py-2">Bab</th>
                      <th className="px-3 py-2">Deskripsi</th>
                      <th className="px-3 py-2">Target Kelas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {parsedTPs.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td className="px-3 py-1.5 font-bold font-mono text-indigo-600">{item.kode_tp}</td>
                        <td className="px-3 py-1.5">{item.mapel}</td>
                        <td className="px-3 py-1.5 text-slate-500">{item.bab} (Smt {item.semester})</td>
                        <td className="px-3 py-1.5 truncate max-w-xs">{item.deskripsi}</td>
                        <td className="px-3 py-1.5 font-mono text-[10px] text-slate-600 dark:text-zinc-400">
                          {item.targetClasses.join(', ')}
                        </td>
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
                setParsedTPs([]);
                setImportErrors([]);
              }}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveImportedTP}
              disabled={parsedTPs.length === 0}
              isLoading={isSavingImport}
            >
              <CheckCircle className="w-4 h-4 mr-1.5" /> Konfirmasi Simpan {parsedTPs.length} TP
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal 3: Buat TP Manual Baru */}
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
                {BAB_OPTIONS.map((b) => (
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
