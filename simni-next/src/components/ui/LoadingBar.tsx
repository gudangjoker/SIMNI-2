'use client';

import React from 'react';
import { useSyncStore } from '@/stores/sync-store';

export const LoadingBar: React.FC = () => {
  const health = useSyncStore((state) => state.health);
  const isLoading = health === 'loading';

  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-1 z-50 overflow-hidden bg-indigo-950/20" suppressHydrationWarning>
      <div className="h-full bg-amber-400 animate-pulse transition-all shadow-[0_0_12px_#fbbf24]" style={{ width: '100%' }} suppressHydrationWarning />
    </div>
  );
};
