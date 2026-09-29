import { create } from 'zustand';

export type SyncHealth = 'loading' | 'ready' | 'partial' | 'degraded' | 'failed';

export interface SyncState {
  health: SyncHealth;
  isConnected: boolean;
  lastSyncedAt: string | null;
  activeListenersCount: number;
  errorMessage: string | null;

  setHealth: (health: SyncHealth) => void;
  setIsConnected: (connected: boolean) => void;
  setLastSyncedAt: (timestamp: string) => void;
  incrementListeners: () => void;
  decrementListeners: () => void;
  setErrorMessage: (msg: string | null) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  health: 'loading',
  isConnected: true,
  lastSyncedAt: null,
  activeListenersCount: 0,
  errorMessage: null,

  setHealth: (health) => set({ health }),
  setIsConnected: (isConnected) => set({ isConnected }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  incrementListeners: () => set((state) => ({ activeListenersCount: state.activeListenersCount + 1 })),
  decrementListeners: () => set((state) => ({ activeListenersCount: Math.max(0, state.activeListenersCount - 1) })),
  setErrorMessage: (errorMessage) => set({ errorMessage })
}));
