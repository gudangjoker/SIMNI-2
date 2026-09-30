'use client';

import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, RotateCcw, Check, Plus, Trash2, ChevronUp, ChevronDown, 
  Layers, ListOrdered, FileSpreadsheet, Search, Copy, AlertTriangle, 
  Sparkles, CheckCircle2, Sliders, Info
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { 
  LPSBLPTemplate, LPSAspect, LPSBLPSection, LPSIndicator, LPSEvalType,
  DEFAULT_LPS_TEMPLATE, DEFAULT_BLP_TEMPLATE 
} from '@/types/lps-blp-template';

interface FullPageTemplateEditorProps {
  initialReportType: 'LPS' | 'BLP';
  lpsTemplate: LPSBLPTemplate;
  blpTemplate: LPSBLPTemplate;
  onApply: (type: 'LPS' | 'BLP', updatedTemplate: LPSBLPTemplate) => void;
  onReset: (type: 'LPS' | 'BLP') => void;
  onClose: () => void;
}

export const FullPageTemplateEditor: React.FC<FullPageTemplateEditorProps> = ({
  initialReportType,
  lpsTemplate,
  blpTemplate,
  onApply,
  onReset,
  onClose
}) => {
  const { toast } = useToast();

  const [activeType, setActiveType] = useState<'LPS' | 'BLP'>(initialReportType);

  // Working drafts for both templates
  const [draftLps, setDraftLps] = useState<LPSBLPTemplate>(() => JSON.parse(JSON.stringify(lpsTemplate)));
  const [draftBlp, setDraftBlp] = useState<LPSBLPTemplate>(() => JSON.parse(JSON.stringify(blpTemplate)));

  const currentTemplate = activeType === 'LPS' ? draftLps : draftBlp;
  const setTemplate = (updater: (prev: LPSBLPTemplate) => LPSBLPTemplate) => {
    if (activeType === 'LPS') {
      setDraftLps((prev) => updater(prev));
    } else {
      setDraftBlp((prev) => updater(prev));
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Check if draft has unsaved changes compared to source prop
  const hasChanges = useMemo(() => {
    const original = activeType === 'LPS' ? lpsTemplate : blpTemplate;
    return JSON.stringify(currentTemplate) !== JSON.stringify(original);
  }, [activeType, currentTemplate, lpsTemplate, blpTemplate]);

  // Statistics
  const stats = useMemo(() => {
    let aspectCount = 0;
    let indicatorCount = 0;
    currentTemplate.sections.forEach((sec) => {
      aspectCount += sec.aspects.length;
      sec.aspects.forEach((asp) => {
        indicatorCount += asp.indicators.length;
      });
    });
    return {
      sections: currentTemplate.sections.length,
      aspects: aspectCount,
      indicators: indicatorCount
    };
  }, [currentTemplate]);

  // Toggle Collapse
  const toggleCollapse = (secId: string) => {
    setCollapsedSections((prev) => ({ ...prev, [secId]: !prev[secId] }));
  };

  // Section Management
  const handleAddSection = () => {
    const nextCharCode = 65 + currentTemplate.sections.length; // A, B, C, ...
    const nextId = String.fromCharCode(nextCharCode <= 90 ? nextCharCode : 65);
    const newSection: LPSBLPSection = {
      id: `${nextId}_${Date.now()}`,
      title: `${nextId}. Bagian Penilaian Tambahan`,
      aspects: [
        {
          id: `asp_${Date.now()}_1`,
          section: nextId,
          order: 1,
          title: 'Aspek Penilaian Baru',
          evalType: 'grade_per_indicator',
          criteriaOptions: ['A', 'B', 'C', 'D'],
          indicators: [
            { id: `ind_${Date.now()}_1`, code: 'a)', text: 'Butir indikator capaian pertama' }
          ],
          defaultDescription: 'Alhamdulillah ananda menunjukkan perkembangan yang memuaskan.'
        }
      ]
    };

    setTemplate((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
    toast(`Bagian baru berhasil ditambahkan ke template ${activeType}.`, 'success');
  };

  const handleDeleteSection = (secId: string) => {
    if (currentTemplate.sections.length <= 1) {
      toast('Minimal harus terdapat satu bagian penilaian dalam template.', 'warning');
      return;
    }
    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== secId)
    }));
    toast('Bagian penilaian berhasil dihapus.', 'info');
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentTemplate.sections.length) return;

    setTemplate((prev) => {
      const nextSections = [...prev.sections];
      const temp = nextSections[index];
      nextSections[index] = nextSections[targetIndex];
      nextSections[targetIndex] = temp;
      return { ...prev, sections: nextSections };
    });
  };

  // Aspect Management
  const handleAddAspect = (secId: string) => {
    const sec = currentTemplate.sections.find((s) => s.id === secId);
    if (!sec) return;

    const newAspect: LPSAspect = {
      id: `custom_asp_${Date.now()}`,
      section: secId,
      order: sec.aspects.length + 1,
      title: 'Aspek Penilaian Baru',
      evalType: 'grade_per_indicator',
      criteriaOptions: ['A', 'B', 'C', 'D'],
      indicators: [
        { id: `ind_${Date.now()}_1`, code: 'a)', text: 'Tuliskan indikator capaian...' }
      ],
      defaultDescription: 'Alhamdulillah ananda menunjukkan perkembangan yang sangat baik.'
    };

    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => 
        s.id === secId ? { ...s, aspects: [...s.aspects, newAspect] } : s
      )
    }));
    toast('Aspek baru berhasil ditambahkan.', 'success');
  };

  const handleDuplicateAspect = (secId: string, aspect: LPSAspect) => {
    const cloned: LPSAspect = {
      ...JSON.parse(JSON.stringify(aspect)),
      id: `asp_dup_${Date.now()}`,
      title: `${aspect.title} (Salinan)`,
      order: aspect.order + 1,
      indicators: aspect.indicators.map((ind, idx) => ({
        ...ind,
        id: `ind_dup_${Date.now()}_${idx}`
      }))
    };

    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s.id !== secId) return s;
        const idx = s.aspects.findIndex((a) => a.id === aspect.id);
        const nextAspects = [...s.aspects];
        nextAspects.splice(idx + 1, 0, cloned);
        return { ...s, aspects: nextAspects };
      })
    }));
    toast(`Aspek "${aspect.title}" berhasil diduplikasi.`, 'info');
  };

  const handleDeleteAspect = (secId: string, aspectId: string) => {
    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => 
        s.id === secId ? { ...s, aspects: s.aspects.filter((a) => a.id !== aspectId) } : s
      )
    }));
    toast('Aspek penilaian dihapus.', 'info');
  };

  const handleMoveAspect = (secId: string, aspectIndex: number, direction: 'up' | 'down') => {
    const sec = currentTemplate.sections.find((s) => s.id === secId);
    if (!sec) return;
    const targetIndex = direction === 'up' ? aspectIndex - 1 : aspectIndex + 1;
    if (targetIndex < 0 || targetIndex >= sec.aspects.length) return;

    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s.id !== secId) return s;
        const nextAspects = [...s.aspects];
        const temp = nextAspects[aspectIndex];
        nextAspects[aspectIndex] = nextAspects[targetIndex];
        nextAspects[targetIndex] = temp;
        return { ...s, aspects: nextAspects };
      })
    }));
  };

  // Indicator Management
  const handleAddIndicator = (secId: string, aspectId: string) => {
    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) => {
        if (sec.id !== secId) return sec;
        return {
          ...sec,
          aspects: sec.aspects.map((asp) => {
            if (asp.id !== aspectId) return asp;
            const count = asp.indicators.length;
            let nextCode = `${count + 1})`;
            if (asp.evalType === 'grade_per_indicator' || asp.evalType === 'hafalan') {
              nextCode = `${String.fromCharCode(97 + count)})`; // a), b), c)
            } else if (asp.evalType === 'checklist') {
              nextCode = `${count + 1})`; // 1), 2), 3)
            }
            return {
              ...asp,
              indicators: [
                ...asp.indicators,
                { id: `ind_${Date.now()}`, code: nextCode, text: 'Tulis butir capaian indikator...' }
              ]
            };
          })
        };
      })
    }));
  };

  const handleDeleteIndicator = (secId: string, aspectId: string, indicatorId: string) => {
    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) => {
        if (sec.id !== secId) return sec;
        return {
          ...sec,
          aspects: sec.aspects.map((asp) => {
            if (asp.id !== aspectId) return asp;
            return {
              ...asp,
              indicators: asp.indicators.filter((i) => i.id !== indicatorId)
            };
          })
        };
      })
    }));
  };

  const handleMoveIndicator = (secId: string, aspectId: string, indIndex: number, direction: 'up' | 'down') => {
    const sec = currentTemplate.sections.find((s) => s.id === secId);
    if (!sec) return;
    const asp = sec.aspects.find((a) => a.id === aspectId);
    if (!asp) return;

    const targetIndex = direction === 'up' ? indIndex - 1 : indIndex + 1;
    if (targetIndex < 0 || targetIndex >= asp.indicators.length) return;

    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s.id !== secId) return s;
        return {
          ...s,
          aspects: s.aspects.map((a) => {
            if (a.id !== aspectId) return a;
            const nextInds = [...a.indicators];
            const temp = nextInds[indIndex];
            nextInds[indIndex] = nextInds[targetIndex];
            nextInds[targetIndex] = temp;
            return { ...a, indicators: nextInds };
          })
        };
      })
    }));
  };

  // Change Eval Type & Default Criteria
  const handleEvalTypeChange = (secId: string, aspectId: string, newType: LPSEvalType) => {
    let newOptions = ['A', 'B', 'C', 'D'];
    if (newType === 'checklist') newOptions = ['Sudah Terbiasa', 'Belum Terbiasa'];
    else if (newType === 'hafalan') newOptions = ['Hafal', 'Sebagian', 'Belum'];
    else if (newType === 'single_grade') newOptions = ['A', 'B', 'C', 'D'];

    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s.id !== secId) return s;
        return {
          ...s,
          aspects: s.aspects.map((a) => {
            if (a.id !== aspectId) return a;
            return {
              ...a,
              evalType: newType,
              criteriaOptions: newOptions
            };
          })
        };
      })
    }));
  };

  // Apply Changes
  const handleSaveAndApply = (andClose: boolean = false) => {
    onApply(activeType, currentTemplate);
    toast(`Template ${activeType} berhasil diterapkan dan disimpan ke sistem!`, 'success');
    if (andClose) {
      onClose();
    }
  };

  // Reset to Default
  const handleConfirmReset = () => {
    const defaultTemplate = activeType === 'LPS' ? DEFAULT_LPS_TEMPLATE : DEFAULT_BLP_TEMPLATE;
    const cloned = JSON.parse(JSON.stringify(defaultTemplate));
    if (activeType === 'LPS') {
      setDraftLps(cloned);
    } else {
      setDraftBlp(cloned);
    }
    onReset(activeType);
    setIsResetConfirmOpen(false);
    toast(`Template ${activeType} berhasil dikembalikan ke standar wajib SDIT Bina Muda!`, 'info');
  };

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return currentTemplate.sections;
    const q = searchQuery.toLowerCase();

    return currentTemplate.sections.map((sec) => {
      const matchSection = sec.title.toLowerCase().includes(q);
      const matchingAspects = sec.aspects.filter((asp) => {
        const matchAspect = asp.title.toLowerCase().includes(q) || asp.defaultDescription.toLowerCase().includes(q);
        const matchInd = asp.indicators.some((ind) => ind.text.toLowerCase().includes(q) || ind.code.toLowerCase().includes(q));
        return matchAspect || matchInd;
      });

      if (matchSection) return sec;
      return { ...sec, aspects: matchingAspects };
    }).filter((sec) => sec.aspects.length > 0 || sec.title.toLowerCase().includes(q));
  }, [currentTemplate, searchQuery]);

  return (
    <div className="space-y-6 pb-24">
      {/* Top Banner & Navigation */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl transition-colors cursor-pointer"
              title="Kembali ke Input Penilaian Rapor"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <Sliders className="w-4 h-4" />
                </span>
                <h1 className="text-xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
                  Pengaturan Penuh Template Rapor (Full Page)
                </h1>
                {hasChanges ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 rounded-full animate-pulse">
                    Ada Perubahan Belum Diterapkan
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Template Aktif
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Leluasa mengelola, menambah, menghapus, atau mengubah urutan aspek dan butir indikator capaian kurikulum.
              </p>
            </div>
          </div>

          {/* Report Type Switcher */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveType('LPS')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeType === 'LPS'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              LPS (Tengah Semester)
            </button>
            <button
              type="button"
              onClick={() => setActiveType('BLP')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeType === 'BLP'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              BLP (Akhir Semester)
            </button>
          </div>
        </div>

        {/* Quick Stats & Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800 text-xs">
          <div className="flex items-center gap-3 text-slate-600 dark:text-zinc-400">
            <span className="flex items-center gap-1 bg-slate-50 dark:bg-zinc-800 px-2.5 py-1 rounded-lg font-semibold">
              <Layers className="w-3.5 h-3.5 text-indigo-500" /> {stats.sections} Bagian Utama
            </span>
            <span className="flex items-center gap-1 bg-slate-50 dark:bg-zinc-800 px-2.5 py-1 rounded-lg font-semibold">
              <ListOrdered className="w-3.5 h-3.5 text-indigo-500" /> {stats.aspects} Aspek Penilaian
            </span>
            <span className="flex items-center gap-1 bg-slate-50 dark:bg-zinc-800 px-2.5 py-1 rounded-lg font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> {stats.indicators} Butir Indikator
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsResetConfirmOpen(true)}
              className="gap-1.5 text-rose-600 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset ke Template Wajib
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-slate-600 dark:text-zinc-300"
            >
              Tutup & Kembali
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSaveAndApply(false)}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-bold"
            >
              <Check className="w-4 h-4" />
              Terapkan Template
            </Button>
          </div>
        </div>
      </div>

      {/* Search and Add Section Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari aspek atau butir indikator capaian..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddSection}
            className="gap-1.5 bg-white dark:bg-zinc-900 font-bold border-indigo-200 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400"
          >
            <Plus className="w-4 h-4" /> Tambah Bagian Utama (Section)
          </Button>
        </div>
      </div>

      {/* Sections and Aspects List */}
      <div className="space-y-6">
        {filteredSections.map((sec, secIdx) => {
          const isCollapsed = !!collapsedSections[sec.id];

          return (
            <div
              key={sec.id}
              className="bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm transition-all"
            >
              {/* Section Header */}
              <div className="p-4 bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(sec.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-zinc-700 cursor-pointer"
                  >
                    {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                  </button>

                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    {sec.title.charAt(0) || String.fromCharCode(65 + secIdx)}
                  </div>

                  <input
                    type="text"
                    value={sec.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTemplate((prev) => ({
                        ...prev,
                        sections: prev.sections.map((s) => (s.id === sec.id ? { ...s, title: val } : s))
                      }));
                    }}
                    placeholder="Judul Bagian Utama..."
                    className="flex-1 text-sm font-bold text-slate-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 self-end md:self-auto shrink-0">
                  <button
                    type="button"
                    disabled={secIdx === 0}
                    onClick={() => handleMoveSection(secIdx, 'up')}
                    className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 cursor-pointer"
                    title="Geser Bagian ke Atas"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={secIdx === currentTemplate.sections.length - 1}
                    onClick={() => handleMoveSection(secIdx, 'down')}
                    className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 cursor-pointer"
                    title="Geser Bagian ke Bawah"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddAspect(sec.id)}
                    className="gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900 ml-2"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Aspek
                  </Button>

                  <button
                    type="button"
                    onClick={() => handleDeleteSection(sec.id)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer ml-1"
                    title="Hapus Seluruh Bagian Ini"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Section Body */}
              {!isCollapsed && (
                <div className="p-4 space-y-5">
                  {sec.aspects.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
                      <p className="text-xs text-slate-400 font-medium">Belum ada aspek penilaian di bagian ini.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddAspect(sec.id)}
                        className="mt-3 gap-1 text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Buat Aspek Pertama
                      </Button>
                    </div>
                  ) : (
                    sec.aspects.map((asp, aspIdx) => (
                      <div
                        key={asp.id}
                        className="p-4 bg-slate-50/70 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3.5 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all"
                      >
                        {/* Aspect Top Row */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="w-6 h-6 rounded-md bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                              #{aspIdx + 1}
                            </span>
                            <input
                              type="text"
                              value={asp.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTemplate((prev) => ({
                                  ...prev,
                                  sections: prev.sections.map((s) => {
                                    if (s.id !== sec.id) return s;
                                    return {
                                      ...s,
                                      aspects: s.aspects.map((a) => (a.id === asp.id ? { ...a, title: val } : a))
                                    };
                                  })
                                }));
                              }}
                              placeholder="Nama Aspek Penilaian..."
                              className="flex-1 text-xs font-bold px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Eval Type Selector */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-400">Tipe Nilai:</span>
                              <select
                                value={asp.evalType}
                                onChange={(e) => handleEvalTypeChange(sec.id, asp.id, e.target.value as LPSEvalType)}
                                className="text-xs font-bold px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                              >
                                <option value="grade_per_indicator">Skor Huruf per Indikator (A, B, C, D)</option>
                                <option value="checklist">Checklist (Sudah / Belum Terbiasa)</option>
                                <option value="hafalan">Hafalan (Hafal / Sebagian / Belum)</option>
                                <option value="single_grade">Nilai Tunggal per Aspek (A, B, C, D)</option>
                              </select>
                            </div>

                            {/* Move Up/Down Aspect */}
                            <div className="flex items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-0.5">
                              <button
                                type="button"
                                disabled={aspIdx === 0}
                                onClick={() => handleMoveAspect(sec.id, aspIdx, 'up')}
                                className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                                title="Naikkan Aspek"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={aspIdx === sec.aspects.length - 1}
                                onClick={() => handleMoveAspect(sec.id, aspIdx, 'down')}
                                className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                                title="Turunkan Aspek"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Duplicate Aspect */}
                            <button
                              type="button"
                              onClick={() => handleDuplicateAspect(sec.id, asp)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg cursor-pointer"
                              title="Duplikat Aspek Ini"
                            >
                              <Copy className="w-4 h-4" />
                            </button>

                            {/* Delete Aspect */}
                            <button
                              type="button"
                              onClick={() => handleDeleteAspect(sec.id, asp.id)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg cursor-pointer"
                              title="Hapus Aspek Ini"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Indicators Inside Aspect */}
                        <div className="pl-3 sm:pl-5 border-l-2 border-indigo-300 dark:border-indigo-800 space-y-2 pt-1">
                          <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                            <span>Daftar Butir Indikator Capaian ({asp.indicators.length} butir):</span>
                            <span className="text-[10px] text-slate-400">
                              Format kriteria: {asp.criteriaOptions.join(', ')}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {asp.indicators.map((ind, indIdx) => (
                              <div key={ind.id} className="flex items-center gap-2 group">
                                <div className="flex items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md p-0.5 opacity-60 group-hover:opacity-100">
                                  <button
                                    type="button"
                                    disabled={indIdx === 0}
                                    onClick={() => handleMoveIndicator(sec.id, asp.id, indIdx, 'up')}
                                    className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                                  >
                                    <ChevronUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={indIdx === asp.indicators.length - 1}
                                    onClick={() => handleMoveIndicator(sec.id, asp.id, indIdx, 'down')}
                                    className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                                  >
                                    <ChevronDown className="w-3 h-3" />
                                  </button>
                                </div>

                                <input
                                  type="text"
                                  value={ind.code}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setTemplate((prev) => ({
                                      ...prev,
                                      sections: prev.sections.map((s) => {
                                        if (s.id !== sec.id) return s;
                                        return {
                                          ...s,
                                          aspects: s.aspects.map((a) => {
                                            if (a.id !== asp.id) return a;
                                            return {
                                              ...a,
                                              indicators: a.indicators.map((i) => (i.id === ind.id ? { ...i, code: val } : i))
                                            };
                                          })
                                        };
                                      })
                                    }));
                                  }}
                                  placeholder="Kode"
                                  className="w-14 text-center font-mono font-bold text-xs px-2 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500"
                                />

                                <input
                                  type="text"
                                  value={ind.text}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setTemplate((prev) => ({
                                      ...prev,
                                      sections: prev.sections.map((s) => {
                                        if (s.id !== sec.id) return s;
                                        return {
                                          ...s,
                                          aspects: s.aspects.map((a) => {
                                            if (a.id !== asp.id) return a;
                                            return {
                                              ...a,
                                              indicators: a.indicators.map((i) => (i.id === ind.id ? { ...i, text: val } : i))
                                            };
                                          })
                                        };
                                      })
                                    }));
                                  }}
                                  placeholder="Teks uraian capaian indikator..."
                                  className="flex-1 text-xs px-3 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-zinc-200"
                                />

                                <button
                                  type="button"
                                  onClick={() => handleDeleteIndicator(sec.id, asp.id, ind.id)}
                                  className="p-1 text-slate-300 hover:text-rose-500 cursor-pointer"
                                  title="Hapus Indikator"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddIndicator(sec.id, asp.id)}
                            className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer pt-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Tambah Butir Indikator
                          </button>

                          {/* Default Description / Narasi Bawaan */}
                          <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              Teks Deskripsi Capaian Bawaan (Otomatis terisi jika belum diedit khusus per siswa):
                            </label>
                            <textarea
                              rows={2}
                              value={asp.defaultDescription}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTemplate((prev) => ({
                                  ...prev,
                                  sections: prev.sections.map((s) => {
                                    if (s.id !== sec.id) return s;
                                    return {
                                      ...s,
                                      aspects: s.aspects.map((a) => (a.id === asp.id ? { ...a, defaultDescription: val } : a))
                                    };
                                  })
                                }));
                              }}
                              className="w-full text-xs px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-zinc-300"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800 p-3 sm:px-8 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              Template: <span className="text-indigo-600 dark:text-indigo-400">{activeType}</span> ({stats.sections} Bagian • {stats.aspects} Aspek • {stats.indicators} Indikator)
            </span>
            {hasChanges ? (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Belum disimpan
              </span>
            ) : (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Sudah diterapkan
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsResetConfirmOpen(true)}
              className="text-xs text-rose-600 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50"
            >
              Reset Standar Wajib
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Batal
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSaveAndApply(false)}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5"
            >
              <Check className="w-4 h-4" /> Terapkan Template
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSaveAndApply(true)}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
            >
              Terapkan & Kembali ke Rapor
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal: Reset to Default Template */}
      <Modal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        title={`Konfirmasi Reset Template ${activeType}`}
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              Tindakan ini akan mengembalikan seluruh susunan bagian, aspek, dan butir indikator capaian rapor <strong>{activeType}</strong> persis sesuai dengan file template wajib resmi SDIT Bina Muda:
              <ul className="list-disc list-inside mt-2 space-y-1 font-medium">
                <li>Struktur Bagian A & B bawaan</li>
                <li>Seluruh butir 7 Kebiasaan, Pembiasaan, Hafalan, & Prestasi Akademik</li>
                <li>Menghapus aspek kustom tambahan yang pernah dibuat</li>
              </ul>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-zinc-400">
            Apakah Anda yakin ingin melanjutkan reset template?
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsResetConfirmOpen(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmReset}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              Ya, Reset ke Template Wajib
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
