import { create } from "zustand";
import { MarketData } from "@/utils/marketContracts";

export type MainTab = "markets" | "mint";
export type MarketSubTab = "browse" | "create" | "my-markets" | "my-bets";

interface MarketStore {
  mainTab: MainTab;
  setMainTab: (tab: MainTab) => void;
  marketSubTab: MarketSubTab;
  setMarketSubTab: (tab: MarketSubTab) => void;
  selectedMarketId: bigint | null;
  setSelectedMarketId: (id: bigint | null) => void;
  cachedMarkets: Map<string, MarketData>;
  setCachedMarket: (id: bigint, market: MarketData) => void;
  getCachedMarket: (id: bigint) => MarketData | undefined;
  clearCache: () => void;
  isLoadingMarkets: boolean;
  setIsLoadingMarkets: (loading: boolean) => void;
  refreshTrigger: number;
  triggerRefresh: () => void;
}

export const useMarketStore = create<MarketStore>((set, get) => ({
  mainTab: "markets",
  setMainTab: (tab) => set({ mainTab: tab }),
  marketSubTab: "browse",
  setMarketSubTab: (tab) => set({ marketSubTab: tab }),
  selectedMarketId: null,
  setSelectedMarketId: (id) => set({ selectedMarketId: id }),
  cachedMarkets: new Map<string, MarketData>(),
  setCachedMarket: (id, market) =>
    set((state) => {
      const newCache = new Map(state.cachedMarkets);
      newCache.set(id.toString(), market);
      return { cachedMarkets: newCache };
    }),
  getCachedMarket: (id) => get().cachedMarkets.get(id.toString()),
  clearCache: () => set({ cachedMarkets: new Map<string, MarketData>() }),
  isLoadingMarkets: false,
  setIsLoadingMarkets: (loading) => set({ isLoadingMarkets: loading }),
  refreshTrigger: 0,
  triggerRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
}));