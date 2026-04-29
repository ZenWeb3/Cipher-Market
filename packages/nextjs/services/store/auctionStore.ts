import { create } from "zustand";
import { AuctionData } from "@/utils/auctionContracts";

export type MainTab = "auctions" | "mint";
export type AuctionSubTab = "browse" | "create" | "my-auctions" | "my-bids";

interface AuctionStore {
  // Navigation
  mainTab: MainTab;
  setMainTab: (tab: MainTab) => void;
  auctionSubTab: AuctionSubTab;
  setAuctionSubTab: (tab: AuctionSubTab) => void;

  // Selected auction for detail view
  selectedAuctionId: bigint | null;
  setSelectedAuctionId: (id: bigint | null) => void;

  // Cached auctions (for quick access)
  cachedAuctions: Map<string, AuctionData>;
  setCachedAuction: (id: bigint, auction: AuctionData) => void;
  getCachedAuction: (id: bigint) => AuctionData | undefined;
  clearCache: () => void;

  // Loading states
  isLoadingAuctions: boolean;
  setIsLoadingAuctions: (loading: boolean) => void;

  // Refresh trigger (increment to force refetch)
  refreshTrigger: number;
  triggerRefresh: () => void;
}

export const useAuctionStore = create<AuctionStore>((set, get) => ({
  // Navigation - default to mint tab for new users
  mainTab: "mint",
  setMainTab: (tab) => set({ mainTab: tab }),
  auctionSubTab: "browse",
  setAuctionSubTab: (tab) => set({ auctionSubTab: tab }),

  // Selected auction for detail view
  selectedAuctionId: null,
  setSelectedAuctionId: (id) => set({ selectedAuctionId: id }),

  // Cached auctions (for quick access)
  cachedAuctions: new Map<string, AuctionData>(),
  setCachedAuction: (id, auction) =>
    set((state) => {
      const newCache = new Map(state.cachedAuctions);
      newCache.set(id.toString(), auction);
      return { cachedAuctions: newCache };
    }),
  getCachedAuction: (id) => get().cachedAuctions.get(id.toString()),
  clearCache: () => set({ cachedAuctions: new Map<string, AuctionData>() }),

  // Loading states
  isLoadingAuctions: false,
  setIsLoadingAuctions: (loading) => set({ isLoadingAuctions: loading }),

  // Refresh trigger (increment to force refetch)
  refreshTrigger: 0,
  triggerRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
}));
