'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Users, CalendarCheck, Award, BookOpen, 
  FileText, GraduationCap, FolderGit2, Settings, ShieldCheck, 
  X, Sparkles 
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Data Siswa', href: '/students', icon: Users },
    { label: 'Presensi', href: '/attendance', icon: CalendarCheck },
    { label: 'Input Nilai TP', href: '/grades', icon: Award },
    { label: 'Rapor LPS / BLP', href: '/lps', icon: GraduationCap },
    { label: 'Jurnal Mengajar', href: '/journal', icon: BookOpen },
    { label: 'Laporan BTQ', href: '/btq', icon: Sparkles },
    { label: 'Catatan Guru', href: '/notes', icon: FileText },
    { label: 'File & Dokumen', href: '/documents', icon: FolderGit2 },
    { label: 'Generator GADM', href: '/gadm', icon: BookOpen },
    { label: 'Kelola Akun', href: '/accounts', icon: ShieldCheck },
    { label: 'Pengaturan', href: '/settings', icon: Settings },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
        aria-hidden="true" 
      />

      {/* Drawer Panel */}
      <div className="relative w-72 max-w-[80vw] h-full bg-white dark:bg-zinc-950 border-r border-slate-100 dark:border-zinc-800 shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-indigo-600/30">
              S
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-zinc-100 tracking-tight">SIMNI</h2>
              <p className="text-[10px] font-semibold text-slate-400">Digital Classroom Hub</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Links Navigation */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150',
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900 hover:text-slate-900 dark:hover:text-zinc-200'
                )}
              >
                <Icon className={cn('w-4 h-4', isActive ? 'text-white' : 'text-slate-400 dark:text-zinc-500')} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};
