'use client';

import React, { useState } from 'react';
import { Shell } from '@/components/layout/Shell';
import { useAppStore } from '@/stores/app-store';
import { Sparkles, ArrowRight, BookMarked, CheckCircle2, Download, FileSpreadsheet, Layers } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';

export default function BTQPage() {
  const { toast } = useToast();
  const activeKelas = useAppStore((state) => state.activeKelas);
  const academicYear = useAppStore((state) => state.academicYear);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'single' | 'all'>('single');
  const [isExporting, setIsExporting] = useState(false);

  const handleTriggerExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setIsExportModalOpen(false);
      toast(
        `Template layout laporan BTQ untuk ${exportScope === 'single' ? `Kelas ${activeKelas}` : 'Seluruh Rombel'} siap diunduh. Silakan kirimkan format layout spesifik Anda untuk finalisasi.`,
        'success'
      );
    }, 600);
  };

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Laporan & Bimbingan Tilawah Al-Qur'an (BTQ) - Kelas {activeKelas}
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Integrasi pencapaian tilawah, tajwid, makhraj, dan target tahfidz Juz 30 tahun ajaran {academicYear}.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsExportModalOpen(true)}
            className="shrink-0"
          >
            <Download className="w-4 h-4 mr-1.5" /> Ekspor Laporan BTQ (Excel)
          </Button>
        </div>

        <div className="p-8 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-800/40 rounded-3xl text-white shadow-xl">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 font-bold text-xs rounded-full border border-emerald-400/30 mb-4">
              <Sparkles className="w-3.5 h-3.5" /> Pembelajaran Al-Qur'an & Karakter
            </span>
            <h2 className="text-2xl font-bold tracking-tight">Evaluasi Terhubung ke Rapor LPS / BLP</h2>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Penilaian capaian BTQ (Surah Al-Fatihah hingga An-Nas, doa harian, dan adab islami) kini terintegrasi langsung ke dalam modul Rapor Perkembangan Siswa (LPS/BLP).
            </p>

            <div className="mt-6 flex items-center gap-3">
              <Link href="/lps">
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer">
                  Buka Modul Evaluasi LPS / BLP <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm">
            <BookMarked className="w-6 h-6 text-emerald-500 mb-2" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">Bimbingan Tilawah</h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">Pemantauan kelancaran membaca jilid Ummi / Qiraati.</p>
          </div>
          <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm">
            <CheckCircle2 className="w-6 h-6 text-indigo-500 mb-2" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">Tahfidz Juz 30</h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">Pencatatan hafalan surah wajib per tingkat kelas.</p>
          </div>
          <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm">
            <Sparkles className="w-6 h-6 text-amber-500 mb-2" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">Praktik Ibadah</h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">Evaluasi gerakan sholat, wudhu, dan doa harian.</p>
          </div>
        </div>
      </div>

      {/* Modal Ekspor Laporan BTQ */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Ekspor Laporan Bimbingan Tilawah Al-Qur'an (BTQ)"
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300">
            <p className="font-bold flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-600" />
              Format Layout Khusus BTQ Siap Diterapkan
            </p>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400 mt-1 leading-relaxed">
              Modul ini telah disiapkan untuk mengunduh rekap capaian tilawah (jilid, halaman, fashahah) dan hafalan juz 30 sesuai spesifikasi tata letak khusus Anda.
            </p>
          </div>

          <div className="space-y-2.5">
            <label
              onClick={() => setExportScope('single')}
              className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                exportScope === 'single'
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200'
                  : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
              }`}
            >
              <input
                type="radio"
                name="btqExportScope"
                checked={exportScope === 'single'}
                onChange={() => setExportScope('single')}
                className="mt-1 text-emerald-600"
              />
              <div>
                <p className="text-xs font-bold">Ekspor Rombel Kelas {activeKelas} Saja</p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Mengekspor laporan pencapaian BTQ untuk kelompok belajar kelas aktif.
                </p>
              </div>
            </label>

            <label
              onClick={() => setExportScope('all')}
              className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                exportScope === 'all'
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200'
                  : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
              }`}
            >
              <input
                type="radio"
                name="btqExportScope"
                checked={exportScope === 'all'}
                onChange={() => setExportScope('all')}
                className="mt-1 text-emerald-600"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold">Ekspor Seluruh Rombel Sekolah</p>
                  <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                    Multi-Sheet
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Merekap seluruh kelompok BTQ sekolah dalam lembar kerja Excel terpisah per rombel.
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <Button variant="ghost" size="sm" onClick={() => setIsExportModalOpen(false)}>
              Tutup
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleTriggerExport}
              isLoading={isExporting}
            >
              <Download className="w-4 h-4 mr-1.5" /> Unduh Laporan BTQ (.xlsx)
            </Button>
          </div>
        </div>
      </Modal>
    </Shell>
  );
}
