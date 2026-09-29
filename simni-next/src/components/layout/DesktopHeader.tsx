'use client';

import React from 'react';
import { Menu, LogOut, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import { useSyncStore } from '@/stores/sync-store';
import { ThemeToggle } from '../ui/ThemeToggle';
import { ClassId } from '@/types/auth';

const CLASSES: ClassId[] = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B', 'PJOK'];

export const DesktopHeader: React.FC<{ onOpenDrawer: () => void }> = ({ onOpenDrawer }) => {
  const activeKelas = useAppStore((state) => state.activeKelas);
  const setActiveKelas = useAppStore((state) => state.setActiveKelas);
  const settings = useAppStore((state) => state.pengaturan);

  const health = useSyncStore((state) => state.health);
  const isConnected = useSyncStore((state) => state.isConnected);

  const syncIcons = {
    loading: <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />,
    ready: <CheckCircle className="w-4 h-4 text-emerald-500" />,
    partial: <AlertCircle className="w-4 h-4 text-amber-500" />,
    degraded: <AlertCircle className="w-4 h-4 text-rose-500" />,
    failed: <AlertCircle className="w-4 h-4 text-rose-500" />
  };

  return (
    <header className="hidden md:flex items-center justify-between px-6 py-3 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800/80 sticky top-0 z-40">
      {/* Sisi Kiri: Menu Drawer & Brand */}
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenDrawer}
          className="p-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Buka menu navigasi"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            S
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-900 dark:text-zinc-100 tracking-tight">SIMNI</span>
              <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-extrabold px-1.5 py-0.5 rounded">PRO</span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium truncate max-w-xs">{settings.nama_sekolah}</p>
          </div>
        </div>

        {/* Kelas Selector Dropdown */}
        <div className="ml-4 pl-4 border-l border-slate-200 dark:border-zinc-800">
          <select
            value={activeKelas}
            onChange={(e) => setActiveKelas(e.target.value as ClassId)}
            className="text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-3 py-1.5 rounded-lg border-0 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                Kelas {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sisi Kanan: Status Sinkronisasi, Tema, Profil */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
          {isConnected ? syncIcons[health] : <AlertCircle className="w-4 h-4 text-rose-500" />}
          <span>{isConnected ? health.toUpperCase() : 'OFFLINE'}</span>
        </div>

        <ThemeToggle />

        <button
          onClick={() => {
            if (typeof window !== 'undefined') window.location.href = '/login';
          }}
          className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          title="Keluar Akun"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
