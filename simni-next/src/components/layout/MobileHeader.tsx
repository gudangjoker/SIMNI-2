'use client';

import React from 'react';
import { Menu } from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import { ThemeToggle } from '../ui/ThemeToggle';
import { ClassId } from '@/types/auth';

const CLASSES: ClassId[] = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B', 'PJOK'];

export const MobileHeader: React.FC<{ onOpenDrawer: () => void }> = ({ onOpenDrawer }) => {
  const activeKelas = useAppStore((state) => state.activeKelas);
  const setActiveKelas = useAppStore((state) => state.setActiveKelas);

  return (
    <header className="flex md:hidden items-center justify-between px-4 py-2.5 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenDrawer}
          className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
          aria-label="Buka menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <span className="text-sm font-black text-slate-900 dark:text-zinc-100 tracking-tight">SIMNI</span>

        <select
          value={activeKelas}
          onChange={(e) => setActiveKelas(e.target.value as ClassId)}
          className="text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-2.5 py-1 rounded-md border-0"
        >
          {CLASSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1">
        <ThemeToggle />
      </div>
    </header>
  );
};
