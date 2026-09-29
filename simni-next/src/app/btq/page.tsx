'use client';

import React from 'react';
import { Shell } from '@/components/layout/Shell';
import { useAppStore } from '@/stores/app-store';
import { Sparkles, ArrowRight, BookMarked, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function BTQPage() {
  const activeKelas = useAppStore((state) => state.activeKelas);

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
            Laporan & Bimbingan Tilawah Al-Qur\'an (BTQ) - Kelas {activeKelas}
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Integrasi pencapaian tilawah, tajwid, makhraj, dan target tahfidz Juz 30.
          </p>
        </div>

        <div className="p-8 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-800/40 rounded-3xl text-white shadow-xl">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 font-bold text-xs rounded-full border border-emerald-400/30 mb-4">
              <Sparkles className="w-3.5 h-3.5" /> Pembelajaran Al-Qur\'an & Karakter
            </span>
            <h2 className="text-2xl font-bold tracking-tight">Evaluasi Terhubung ke Rapor LPS / BLP</h2>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Penilaian capaian BTQ (Surah Al-Fatihah hingga An-Nas, doa harian, dan adab islami) kini terintegrasi langsung ke dalam modul Rapor Perkembangan Siswa (LPS/BLP).
            </p>

            <div className="mt-6 flex items-center gap-3">
              <Link href="/lps">
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md">
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
    </Shell>
  );
}
