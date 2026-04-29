import { create } from "zustand";

interface CofheState {
  isInitialized: boolean;
  setIsInitialized: (isInitialized: boolean) => void;
  balanceUpdateTrigger: number;
  triggerBalanceUpdate: () => void;
  /**
   * Bumped whenever a permit is created, removed, or the active permit changes.
   * Consumers use this as a reactive dependency to re-read from `cofheClient.permits.*`.
   */
  permitVersion: number;
  bumpPermitVersion: () => void;
}

export const useCofheStore = create<CofheState>((set) => ({
  isInitialized: false,
  setIsInitialized: (isInitialized: boolean) => set({ isInitialized }),
  balanceUpdateTrigger: 0,
  triggerBalanceUpdate: () =>
    set((state) => ({
      balanceUpdateTrigger: state.balanceUpdateTrigger + 1,
    })),
  permitVersion: 0,
  bumpPermitVersion: () =>
    set((state) => ({ permitVersion: state.permitVersion + 1 })),
}));
