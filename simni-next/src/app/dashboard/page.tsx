'use client';

import React from 'react';
import { Shell } from '@/components/layout/Shell';
import { useAppStore } from '@/stores/app-store';
import { Users, CalendarCheck, Award, BookOpen, AlertTriangle, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const activeKelas = useAppStore((state) => state.activeKelas);
  const settings = useAppStore((state) => state.pengaturan);
  const students = useAppStore((state) => state.students);
  const presensi = useAppStore((state) => state.presensi);
  const mapelTP = useAppStore((state) => state.mapelTP);
  const jurnal = useAppStore((state) => state.jurnal);

  const totalSiswa = Object.keys(students).length;
  const totalPresensi = Object.keys(presensi).length;
  const totalTP = Object.keys(mapelTP).length;
  const totalJurnal = Object.keys(jurnal).length;

  const kpis = [
    { label: 'Total Siswa Aktif', value: totalSiswa, icon: Users, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
    { label: 'Catatan Kehadiran', value: totalPresensi, icon: CalendarCheck, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
    { label: 'Tujuan Pembelajaran (TP)', value: totalTP, icon: Award, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
    { label: 'Jurnal Mengajar', value: totalJurnal, icon: BookOpen, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/40' },
  ];

  return (
    <Shell>
      <div className="space-y-6" suppressHydrationWarning>
        {/* Welcome Banner */}
        <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-950 text-white border border-indigo-800/40 shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <span className="inline-block px-3 py-1 bg-indigo-500/20 text-indigo-300 font-bold text-xs rounded-full border border-indigo-400/30 mb-3">
              Tahun Ajaran {settings.tahun_pelajaran} • Ruang Kelas {activeKelas}
            </span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              Selamat Bertugas di SIMNI
            </h1>
            <p className="text-xs md:text-sm text-indigo-200/80 mt-1 max-w-xl">
              Platform administrasi kelas, capaian kompetensi siswa, dan evaluasi Kurikulum Merdeka yang siap digunakan dalam kondisi koneksi terbatas.
            </p>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div
                key={idx}
                className="p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{kpi.label}</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-zinc-100 mt-1">{kpi.value}</p>
                </div>
                <div className={`p-3 rounded-2xl ${kpi.bg} ${kpi.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Early Warning Radar & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Radar */}
          <div className="lg:col-span-2 p-6 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Early Warning Radar Siswa</h2>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-zinc-950/50 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 text-center py-8">
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                Semua siswa terpantau dalam kondisi kehadiran dan capaian pembelajaran yang baik.
              </p>
            </div>
          </div>

          {/* Quick Hub */}
          <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-4">Aksi Cepat</h2>
              <div className="space-y-2">
                <Link
                  href="/attendance"
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-xs font-semibold text-slate-700 dark:text-zinc-200 transition-colors"
                >
                  <span>Catat Presensi Hari Ini</span>
                  <ArrowUpRight className="w-4 h-4 text-indigo-500" />
                </Link>
                <Link
                  href="/grades"
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-xs font-semibold text-slate-700 dark:text-zinc-200 transition-colors"
                >
                  <span>Input Nilai TP Baru</span>
                  <ArrowUpRight className="w-4 h-4 text-indigo-500" />
                </Link>
                <Link
                  href="/journal"
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-xs font-semibold text-slate-700 dark:text-zinc-200 transition-colors"
                >
                  <span>Tulis Jurnal Mengajar</span>
                  <ArrowUpRight className="w-4 h-4 text-indigo-500" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
