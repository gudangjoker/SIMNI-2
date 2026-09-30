'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Shell } from '@/components/layout/Shell';
import { useAppStore } from '@/stores/app-store';
import { 
  GraduationCap, Download, Save, Settings, ChevronLeft, ChevronRight, 
  Check, Plus, Trash2, RotateCcw, Sparkles, BookOpen, User, Calendar,
  FileSpreadsheet, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { 
  LPSBLPTemplate, LPSAspect, LPSIndicator, StudentEvaluationData,
  DEFAULT_LPS_TEMPLATE, DEFAULT_BLP_TEMPLATE 
} from '@/types/lps-blp-template';
import { exportReportToExcel } from '@/lib/excel/lps-blp-excel';
import { ClassId } from '@/types/auth';

export default function LPSBLPPage() {
  const { toast } = useToast();
  const activeKelas = useAppStore((state) => state.activeKelas);
  const setActiveKelas = useAppStore((state) => state.setActiveKelas);
  const academicYear = useAppStore((state) => state.academicYear);
  const studentsMap = useAppStore((state) => state.students);

  // Active Report Type: LPS (Tengah Semester) or BLP (Akhir Semester)
  const [reportType, setReportType] = useState<'LPS' | 'BLP'>('LPS');
  const [semester, setSemester] = useState<'1' | '2'>('2');

  // Custom Templates (loaded from localStorage or defaults)
  const [lpsTemplate, setLpsTemplate] = useState<LPSBLPTemplate>(DEFAULT_LPS_TEMPLATE);
  const [blpTemplate, setBlpTemplate] = useState<LPSBLPTemplate>(DEFAULT_BLP_TEMPLATE);

  const activeTemplate = reportType === 'LPS' ? lpsTemplate : blpTemplate;

  // Active Student
  const [selectedNisn, setSelectedNisn] = useState<string>('');

  // Class Students
  const classStudents = useMemo(() => {
    return Object.values(studentsMap)
      .filter((s) => s.Kelas === activeKelas)
      .sort((a, b) => a['Nama Lengkap'].localeCompare(b['Nama Lengkap']));
  }, [studentsMap, activeKelas]);

  useEffect(() => {
    if (classStudents.length > 0 && (!selectedNisn || !classStudents.some(s => s.NISN === selectedNisn))) {
      setSelectedNisn(classStudents[0].NISN);
    }
  }, [classStudents, selectedNisn]);

  const activeStudentIndex = classStudents.findIndex((s) => s.NISN === selectedNisn);
  const activeStudent = classStudents[activeStudentIndex] || classStudents[0];

  // Evaluations Store: key = NISN
  const [evaluations, setEvaluations] = useState<Record<string, StudentEvaluationData>>({});
  const [isSaved, setIsSaved] = useState(true);

  // Template Customization Modal
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LPSBLPTemplate>(DEFAULT_LPS_TEMPLATE);

  // Export Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'single' | 'class'>('single');
  const [isExporting, setIsExporting] = useState(false);

  // Load Custom Templates from localStorage
  useEffect(() => {
    try {
      const savedLps = localStorage.getItem('simni_custom_template_lps');
      if (savedLps) setLpsTemplate(JSON.parse(savedLps));

      const savedBlp = localStorage.getItem('simni_custom_template_blp');
      if (savedBlp) setBlpTemplate(JSON.parse(savedBlp));
    } catch {
      // ignore
    }
  }, []);

  // Load Evaluations for current class & report type
  const evalStorageKey = `simni_evaluations_${reportType}_${activeKelas}_${academicYear}_sem${semester}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(evalStorageKey);
      if (saved) {
        setEvaluations(JSON.parse(saved));
      } else {
        setEvaluations({});
      }
      setIsSaved(true);
    } catch {
      // ignore
    }
  }, [evalStorageKey]);

  // Current active student evaluation state
  const currentEval = useMemo<StudentEvaluationData>(() => {
    if (!activeStudent) {
      return {
        studentNisn: '',
        aspectGrades: {},
        indicatorChecks: {},
        descriptions: {}
      };
    }

    const existing = evaluations[activeStudent.NISN];
    if (existing) return existing;

    // Return initialized default evaluation for active template
    const defaultGrades: Record<string, string> = {};
    const defaultChecks: Record<string, string> = {};
    const defaultDescs: Record<string, string> = {};

    activeTemplate.sections.forEach((sec) => {
      sec.aspects.forEach((asp) => {
        defaultGrades[asp.id] = 'B';
        defaultDescs[asp.id] = asp.defaultDescription;
        asp.indicators.forEach((ind) => {
          if (asp.evalType === 'checklist') defaultChecks[ind.id] = 'Sudah Terbiasa';
          else if (asp.evalType === 'hafalan') defaultChecks[ind.id] = 'Hafal';
          else if (asp.evalType === 'grade_per_indicator') defaultChecks[ind.id] = 'A';
          else defaultChecks[ind.id] = 'B';
        });
      });
    });

    return {
      studentNisn: activeStudent.NISN,
      aspectGrades: defaultGrades,
      indicatorChecks: defaultChecks,
      descriptions: defaultDescs,
      masehiDate: reportType === 'LPS' ? '03 Mei 2025' : '22 Desember 2025',
      hijriDate: reportType === 'LPS' ? '05 Dzulqaidah 1446 H' : '3 Rajab 1447 H',
      classMaster: 'Wali Kelas, S.Pd.',
      nuptkMaster: '112231231231231',
      headMaster: 'Kepala Sekolah, S.Pd., Gr.',
      nuptkHead: '525252524242341'
    };
  }, [activeStudent, evaluations, activeTemplate, reportType]);

  // Update active student evaluation
  const updateCurrentEval = (updater: (prev: StudentEvaluationData) => StudentEvaluationData) => {
    if (!activeStudent) return;
    setEvaluations((prev) => {
      const current = currentEval;
      const updated = updater(current);
      return {
        ...prev,
        [activeStudent.NISN]: updated
      };
    });
    setIsSaved(false);
  };

  const handleIndicatorCheck = (indicatorId: string, value: string) => {
    updateCurrentEval((prev) => ({
      ...prev,
      indicatorChecks: {
        ...prev.indicatorChecks,
        [indicatorId]: value
      }
    }));
  };

  const handleAspectGrade = (aspectId: string, grade: string) => {
    updateCurrentEval((prev) => ({
      ...prev,
      aspectGrades: {
        ...prev.aspectGrades,
        [aspectId]: grade
      }
    }));
  };

  const handleDescriptionChange = (aspectId: string, text: string) => {
    updateCurrentEval((prev) => ({
      ...prev,
      descriptions: {
        ...prev.descriptions,
        [aspectId]: text
      }
    }));
  };

  const handleMetaChange = (field: keyof StudentEvaluationData, val: string) => {
    updateCurrentEval((prev) => ({
      ...prev,
      [field]: val
    }));
  };

  // Bulk set for an aspect
  const handleBulkSetAspect = (aspect: LPSAspect, value: string) => {
    updateCurrentEval((prev) => {
      const nextChecks = { ...prev.indicatorChecks };
      aspect.indicators.forEach((ind) => {
        nextChecks[ind.id] = value;
      });
      return {
        ...prev,
        indicatorChecks: nextChecks
      };
    });
    toast(`Semua indikator "${aspect.title}" diatur ke "${value}".`, 'info');
  };

  // Save evaluations
  const handleSave = () => {
    try {
      localStorage.setItem(evalStorageKey, JSON.stringify(evaluations));
      setIsSaved(true);
      toast(`Evaluasi rapor ${reportType} kelas ${activeKelas} berhasil disimpan.`, 'success');
    } catch {
      toast('Gagal menyimpan ke penyimpanan lokal.', 'error');
    }
  };

  // Student Navigation
  const handlePrevStudent = () => {
    if (activeStudentIndex > 0) {
      setSelectedNisn(classStudents[activeStudentIndex - 1].NISN);
    }
  };

  const handleNextStudent = () => {
    if (activeStudentIndex < classStudents.length - 1) {
      setSelectedNisn(classStudents[activeStudentIndex + 1].NISN);
    }
  };

  // Template Customization Handlers
  const handleOpenCustomize = () => {
    setEditingTemplate(JSON.parse(JSON.stringify(activeTemplate)));
    setIsCustomModalOpen(true);
  };

  const handleSaveCustomTemplate = () => {
    if (reportType === 'LPS') {
      setLpsTemplate(editingTemplate);
      localStorage.setItem('simni_custom_template_lps', JSON.stringify(editingTemplate));
    } else {
      setBlpTemplate(editingTemplate);
      localStorage.setItem('simni_custom_template_blp', JSON.stringify(editingTemplate));
    }
    setIsCustomModalOpen(false);
    toast(`Kustomisasi struktur aspek & indikator ${reportType} berhasil disimpan.`, 'success');
  };

  const handleResetToDefaultTemplate = () => {
    const def = reportType === 'LPS' ? DEFAULT_LPS_TEMPLATE : DEFAULT_BLP_TEMPLATE;
    setEditingTemplate(JSON.parse(JSON.stringify(def)));
    toast('Template dikembalikan ke format wajib resmi bawaan SDIT Bina Muda.', 'info');
  };

  // Add Aspect to Editing Template
  const handleAddAspect = (sectionId: 'A' | 'B') => {
    const sec = editingTemplate.sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const newAspect: LPSAspect = {
      id: `custom_asp_${Date.now()}`,
      section: sectionId,
      order: sec.aspects.length + 1,
      title: 'Aspek Penilaian Baru',
      evalType: 'grade_per_indicator',
      criteriaOptions: ['A', 'B', 'C', 'D'],
      indicators: [
        { id: `ind_${Date.now()}_1`, code: 'a)', text: 'Indikator capaian baru' }
      ],
      defaultDescription: 'Alhamdulillah ananda menunjukkan perkembangan yang sangat baik.'
    };
    setEditingTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, aspects: [...s.aspects, newAspect] } : s))
    }));
  };

  // Add Indicator to Aspect
  const handleAddIndicator = (aspectId: string) => {
    setEditingTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) => ({
        ...sec,
        aspects: sec.aspects.map((asp) => {
          if (asp.id !== aspectId) return asp;
          const nextIndex = asp.indicators.length + 1;
          const code = asp.evalType === 'checklist' ? `${nextIndex})` : `${String.fromCharCode(96 + nextIndex)})`;
          return {
            ...asp,
            indicators: [
              ...asp.indicators,
              { id: `ind_${Date.now()}`, code, text: 'Tuliskan butir indikator...' }
            ]
          };
        })
      }))
    }));
  };

  // Delete Aspect
  const handleDeleteAspect = (aspectId: string) => {
    setEditingTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) => ({
        ...sec,
        aspects: sec.aspects.filter((a) => a.id !== aspectId)
      }))
    }));
  };

  // Delete Indicator
  const handleDeleteIndicator = (aspectId: string, indicatorId: string) => {
    setEditingTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) => ({
        ...sec,
        aspects: sec.aspects.map((asp) => {
          if (asp.id !== aspectId) return asp;
          return {
            ...asp,
            indicators: asp.indicators.filter((i) => i.id !== indicatorId)
          };
        })
      }))
    }));
  };

  // Handle Export to Excel
  const handleTriggerExport = async () => {
    if (!activeStudent && exportScope === 'single') return;
    setIsExporting(true);
    try {
      await exportReportToExcel({
        type: reportType,
        template: activeTemplate,
        evaluations,
        students: classStudents,
        academicYear,
        semester,
        classId: activeKelas,
        isSingleStudent: exportScope === 'single',
        targetNisn: activeStudent?.NISN,
        masehiDate: currentEval.masehiDate,
        hijriDate: currentEval.hijriDate,
        classMaster: currentEval.classMaster,
        nuptkMaster: currentEval.nuptkMaster,
        headMaster: currentEval.headMaster,
        nuptkHead: currentEval.nuptkHead
      });
      setIsExportModalOpen(false);
      toast(
        `File Excel ${reportType} (${exportScope === 'single' ? activeStudent['Nama Lengkap'] : `Kelas ${activeKelas}`}) identik dengan template berhasil diunduh.`,
        'success'
      );
    } catch (err: any) {
      toast(err.message || 'Gagal mengekspor file Excel.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Shell>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <GraduationCap className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                Sistem Rapor & Evaluasi Perkembangan Siswa ({reportType})
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Formulir evaluasi karakter, adab, prestasi akademik & hafalan Al-Qur'an terhubung ke format Excel resmi SDIT Bina Muda.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Customization Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenCustomize}
              className="gap-1.5 border-dashed hover:border-indigo-500"
            >
              <Settings className="w-4 h-4 text-indigo-500" />
              Kustomisasi Aspek & Indikator
            </Button>

            {/* Save Button */}
            <Button
              variant={isSaved ? 'outline' : 'primary'}
              size="sm"
              onClick={handleSave}
              className="gap-1.5"
            >
              <Save className="w-4 h-4" />
              {isSaved ? 'Tersimpan' : 'Simpan Evaluasi'}
            </Button>

            {/* Export Button */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsExportModalOpen(true)}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Download className="w-4 h-4" />
              Ekspor Excel (Identik Template)
            </Button>
          </div>
        </div>

        {/* Tab & Filter Bar */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
            {/* Report Type Selector */}
            <div className="inline-flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl">
              <button
                type="button"
                onClick={() => setReportType('LPS')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  reportType === 'LPS'
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                }`}
              >
                LPS (Tengah Semester)
              </button>
              <button
                type="button"
                onClick={() => setReportType('BLP')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  reportType === 'BLP'
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                }`}
              >
                BLP (Akhir Semester)
              </button>
            </div>

            {/* Class & Semester Selectors */}
            <div className="flex items-center gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Kelas / Rombel
                </label>
                <select
                  value={activeKelas}
                  onChange={(e) => setActiveKelas(e.target.value as ClassId)}
                  className="text-xs font-semibold px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {(['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B'] as ClassId[]).map((k) => (
                    <option key={k} value={k}>
                      Kelas {k}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Semester
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value as '1' | '2')}
                  className="text-xs font-semibold px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="1">Semester 1 (Ganjil)</option>
                  <option value="2">Semester 2 (Genap)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Student Selector Navigator */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">Pilih Siswa:</span>
              <select
                value={selectedNisn}
                onChange={(e) => setSelectedNisn(e.target.value)}
                className="text-xs font-bold px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 min-w-[240px]"
              >
                {classStudents.map((s, idx) => (
                  <option key={s.NISN} value={s.NISN}>
                    {idx + 1}. {s['Nama Lengkap']} ({s.NISN})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevStudent}
                disabled={activeStudentIndex <= 0}
                className="gap-1 px-2.5"
              >
                <ChevronLeft className="w-4 h-4" /> Siswa Sebelumnya
              </Button>

              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 px-2">
                {activeStudentIndex + 1} / {classStudents.length}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNextStudent}
                disabled={activeStudentIndex >= classStudents.length - 1}
                className="gap-1 px-2.5"
              >
                Siswa Berikutnya <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Active Student Card Banner */}
        {activeStudent && (
          <div className="p-4 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 border border-indigo-800/40 rounded-2xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/40 border border-indigo-400/30 flex items-center justify-center text-indigo-200 font-bold text-lg">
                {activeStudent['Nama Lengkap'].charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold tracking-tight">{activeStudent['Nama Lengkap']}</h2>
                  <span className="px-2 py-0.5 bg-indigo-500/30 text-indigo-200 text-[10px] font-bold rounded-md border border-indigo-400/20">
                    Kelas {activeKelas}
                  </span>
                </div>
                <p className="text-xs text-indigo-200/70 mt-0.5">
                  NISN: <span className="font-mono">{activeStudent.NISN}</span> • Tahun Pelajaran: {academicYear}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-semibold rounded-xl">
                <CheckCircle2 className="w-4 h-4" /> Siap Diekspor Identik Template
              </span>
            </div>
          </div>
        )}

        {/* Evaluation Form Sections */}
        <div className="space-y-6">
          {activeTemplate.sections.map((section) => (
            <div
              key={section.id}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden"
            >
              {/* Section Header */}
              <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{section.title}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {section.aspects.length} Aspek Penilaian terdaftar
                  </p>
                </div>
              </div>

              {/* Aspects List */}
              <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                {section.aspects.map((aspect, aspIdx) => {
                  const aspectGrade = currentEval.aspectGrades[aspect.id] || 'B';
                  const aspectDesc = currentEval.descriptions[aspect.id] || aspect.defaultDescription;

                  return (
                    <div key={aspect.id} className="p-5 space-y-4">
                      {/* Aspect Top Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center">
                            {aspIdx + 1}
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                              {aspect.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                              Tipe: {aspect.evalType.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>

                        {/* Bulk Action Controls */}
                        {aspect.evalType === 'checklist' && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleBulkSetAspect(aspect, 'Sudah Terbiasa')}
                              className="px-2 py-1 text-[11px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold rounded-lg hover:bg-emerald-100 cursor-pointer"
                            >
                              Centang Semua "Sudah Terbiasa"
                            </button>
                          </div>
                        )}

                        {aspect.evalType === 'hafalan' && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleBulkSetAspect(aspect, 'Hafal')}
                              className="px-2 py-1 text-[11px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold rounded-lg hover:bg-emerald-100 cursor-pointer"
                            >
                              Set Semua "Hafal"
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBulkSetAspect(aspect, 'Sebagian')}
                              className="px-2 py-1 text-[11px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold rounded-lg hover:bg-indigo-100 cursor-pointer"
                            >
                              Set Semua "Sebagian"
                            </button>
                          </div>
                        )}

                        {aspect.evalType === 'single_grade' && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-500 mr-1">Nilai:</span>
                            {(['A', 'B', 'C', 'D'] as const).map((gr) => (
                              <button
                                key={gr}
                                type="button"
                                onClick={() => handleAspectGrade(aspect.id, gr)}
                                className={`w-7 h-7 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                                  aspectGrade === gr
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
                                }`}
                              >
                                {gr}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Indicators checklist/ratings */}
                      {aspect.indicators.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                          {aspect.indicators.map((ind) => {
                            const chosenVal = currentEval.indicatorChecks[ind.id] || (
                              aspect.evalType === 'checklist' ? 'Sudah Terbiasa' :
                              aspect.evalType === 'hafalan' ? 'Hafal' : 'A'
                            );

                            return (
                              <div
                                key={ind.id}
                                className="p-3 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/80 dark:border-zinc-800 rounded-xl flex items-center justify-between gap-3"
                              >
                                <div className="text-xs font-medium text-slate-800 dark:text-zinc-200 leading-snug">
                                  <span className="font-bold text-indigo-600 dark:text-indigo-400 mr-1.5">
                                    {ind.code}
                                  </span>
                                  {ind.text}
                                </div>

                                {/* Options Picker */}
                                <div className="shrink-0 flex items-center gap-1">
                                  {aspect.criteriaOptions.map((opt) => {
                                    const isSelected = chosenVal === opt;
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => handleIndicatorCheck(ind.id, opt)}
                                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                          isSelected
                                            ? opt === 'Sudah Terbiasa' || opt === 'Hafal' || opt === 'A'
                                              ? 'bg-emerald-600 text-white shadow-sm'
                                              : opt === 'Sebagian' || opt === 'B'
                                              ? 'bg-indigo-600 text-white shadow-sm'
                                              : 'bg-amber-600 text-white shadow-sm'
                                            : 'bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-100'
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Description & Recommendations Box */}
                      <div className="pt-2">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                          Deskripsi dan Rekomendasi ({aspect.title}):
                        </label>
                        <textarea
                          rows={3}
                          value={aspectDesc}
                          onChange={(e) => handleDescriptionChange(aspect.id, e.target.value)}
                          placeholder="Tuliskan evaluasi capaian naratif dan motivasi untuk orang tua..."
                          className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 font-normal leading-relaxed resize-y"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Signatures & Dates Settings Card */}
          <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              Titimangsa & Pengesahan Tanda Tangan Laporan ({reportType})
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                  Tanggal Masehi
                </label>
                <input
                  type="text"
                  value={currentEval.masehiDate || ''}
                  onChange={(e) => handleMetaChange('masehiDate', e.target.value)}
                  placeholder="03 Mei 2025"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                  Tanggal Hijriyah
                </label>
                <input
                  type="text"
                  value={currentEval.hijriDate || ''}
                  onChange={(e) => handleMetaChange('hijriDate', e.target.value)}
                  placeholder="05 Dzulqaidah 1446 H"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                  Wali Kelas / Class Master
                </label>
                <input
                  type="text"
                  value={currentEval.classMaster || ''}
                  onChange={(e) => handleMetaChange('classMaster', e.target.value)}
                  placeholder="Nama Guru, S.Pd."
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                  NUPTK Wali Kelas
                </label>
                <input
                  type="text"
                  value={currentEval.nuptkMaster || ''}
                  onChange={(e) => handleMetaChange('nuptkMaster', e.target.value)}
                  placeholder="112231231231231"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Kustomisasi Aspek & Indikator */}
        <Modal
          isOpen={isCustomModalOpen}
          onClose={() => setIsCustomModalOpen(false)}
          title={`Kustomisasi Struktur Aspek & Indikator (${reportType})`}
        >
          <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-amber-800 dark:text-amber-300">
              <span>
                Anda dapat menambah, menghapus, atau mengubah teks aspek dan butir indikator capaian kurikulum.
              </span>
              <button
                type="button"
                onClick={handleResetToDefaultTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs cursor-pointer shrink-0 ml-3"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Template Wajib
              </button>
            </div>

            {/* Editing Sections */}
            {editingTemplate.sections.map((sec) => (
              <div key={sec.id} className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-4">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={sec.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingTemplate((prev) => ({
                        ...prev,
                        sections: prev.sections.map((s) => (s.id === sec.id ? { ...s, title: val } : s))
                      }));
                    }}
                    className="text-xs font-bold px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg w-full max-w-lg"
                  />

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddAspect(sec.id)}
                    className="gap-1 text-xs shrink-0 ml-2"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Aspek
                  </Button>
                </div>

                {/* Aspect Cards inside section */}
                <div className="space-y-3">
                  {sec.aspects.map((asp) => (
                    <div key={asp.id} className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={asp.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingTemplate((prev) => ({
                              ...prev,
                              sections: prev.sections.map((s) => ({
                                ...s,
                                aspects: s.aspects.map((a) => (a.id === asp.id ? { ...a, title: val } : a))
                              }))
                            }));
                          }}
                          placeholder="Nama Aspek Penilaian"
                          className="text-xs font-bold px-2.5 py-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg flex-1"
                        />

                        <select
                          value={asp.evalType}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            let newOpts = ['A', 'B', 'C', 'D'];
                            if (val === 'checklist') newOpts = ['Sudah Terbiasa', 'Belum Terbiasa'];
                            else if (val === 'hafalan') newOpts = ['Hafal', 'Sebagian', 'Belum'];

                            setEditingTemplate((prev) => ({
                              ...prev,
                              sections: prev.sections.map((s) => ({
                                ...s,
                                aspects: s.aspects.map((a) => (a.id === asp.id ? { ...a, evalType: val, criteriaOptions: newOpts } : a))
                              }))
                            }));
                          }}
                          className="text-[11px] font-semibold px-2 py-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg"
                        >
                          <option value="grade_per_indicator">Skor Huruf (A, B, C, D)</option>
                          <option value="checklist">Checklist (Sudah / Belum)</option>
                          <option value="hafalan">Hafalan (Hafal / Sebagian / Belum)</option>
                          <option value="single_grade">Nilai Tunggal Aspek</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleDeleteAspect(asp.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg cursor-pointer"
                          title="Hapus Aspek"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Indicators list inside Aspect */}
                      <div className="pl-3 border-l-2 border-indigo-200 dark:border-indigo-900 space-y-1.5">
                        {asp.indicators.map((ind) => (
                          <div key={ind.id} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={ind.code}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditingTemplate((prev) => ({
                                  ...prev,
                                  sections: prev.sections.map((s) => ({
                                    ...s,
                                    aspects: s.aspects.map((a) => {
                                      if (a.id !== asp.id) return a;
                                      return {
                                        ...a,
                                        indicators: a.indicators.map((i) => (i.id === ind.id ? { ...i, code: val } : i))
                                      };
                                    })
                                  }))
                                }));
                              }}
                              className="w-12 text-[11px] font-mono font-bold text-center px-1.5 py-0.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded"
                            />
                            <input
                              type="text"
                              value={ind.text}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditingTemplate((prev) => ({
                                  ...prev,
                                  sections: prev.sections.map((s) => ({
                                    ...s,
                                    aspects: s.aspects.map((a) => {
                                      if (a.id !== asp.id) return a;
                                      return {
                                        ...a,
                                        indicators: a.indicators.map((i) => (i.id === ind.id ? { ...i, text: val } : i))
                                      };
                                    })
                                  }))
                                }));
                              }}
                              placeholder="Teks indikator capaian..."
                              className="flex-1 text-[11px] px-2 py-0.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeleteIndicator(asp.id, ind.id)}
                              className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                              title="Hapus Indikator"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => handleAddIndicator(asp.id)}
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer pt-1"
                        >
                          <Plus className="w-3 h-3" /> Tambah Butir Indikator
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
              <Button variant="ghost" size="sm" onClick={() => setIsCustomModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveCustomTemplate}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Terapkan & Simpan Kustomisasi
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal Ekspor Excel LPS / BLP */}
        <Modal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          title={`Ekspor File Excel Resmi (${reportType})`}
        >
          <div className="space-y-5">
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Format ekspor akan dihasilkan <strong>100% identik</strong> dengan file{' '}
              <code className="text-indigo-600 font-mono font-bold">{reportType} - Template wajib.xlsx</code>:
              logo sekolah resmi SDIT Bina Muda, font kop (Britannic Bold, Cooper Black, Cambria), border tabel tipis, dan centang ({reportType === 'LPS' ? 'ü' : '✓'}).
            </p>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                Pilih Cakupan Siswa yang Diekspor:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setExportScope('single')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    exportScope === 'single'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm'
                      : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900 dark:text-zinc-100">
                    Siswa Aktif Ini Saja
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {activeStudent ? activeStudent['Nama Lengkap'] : 'Siswa terpilih'} (1 Lembar Rapor).
                  </div>
                </div>

                <div
                  onClick={() => setExportScope('class')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    exportScope === 'class'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm'
                      : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900 dark:text-zinc-100">
                    Seluruh Siswa Kelas {activeKelas}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Satu file Excel berisi {classStudents.length} sheet (1 sheet per siswa).
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Tipe Laporan:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">{reportType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Rombel:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">Kelas {activeKelas}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Semester:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">Semester {semester}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Logo & Kop Sekolah:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">100% Identik Aktif</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setIsExportModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleTriggerExport}
                disabled={isExporting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isExporting ? 'Memproses File Excel...' : 'Unduh File Excel'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Shell>
  );
}
