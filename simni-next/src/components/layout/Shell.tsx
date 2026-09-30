'use client';

import React, { useState } from 'react';
import { DesktopHeader } from './DesktopHeader';
import { MobileHeader } from './MobileHeader';
import { NavigationDrawer } from './NavigationDrawer';
import { LoadingBar } from '../ui/LoadingBar';
import { useFirebaseSync } from '@/hooks/useFirebaseSync';

export const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Activate Realtime Sync on App Shell Mount
  useFirebaseSync();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-zinc-100 flex flex-col font-sans" suppressHydrationWarning>
      <LoadingBar />
      <DesktopHeader onOpenDrawer={() => setDrawerOpen(true)} />
      <MobileHeader onOpenDrawer={() => setDrawerOpen(true)} />
      <NavigationDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-150" suppressHydrationWarning>
        {children}
      </main>
    </div>
  );
};
