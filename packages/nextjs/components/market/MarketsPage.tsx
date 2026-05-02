"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { Search, Plus, User, TrendingUp, Loader2 } from "lucide-react";
import { MarketList } from "./MarketList";
import { MarketDetail } from "./MarketDetail";
import { CreateMarketForm } from "./CreateMarketForm";
import { MarketCard } from "./MarketCard";
import { useMarket } from "@/hooks/useMarket";
import { useMarketStore, MarketSubTab } from "@/services/store/marketStore";
import { MarketData } from "@/utils/marketContracts";

const TABS: { id: MarketSubTab; label: string; icon: typeof Search }[] = [
  { id: "browse", label: "Browse", icon: Search },
  { id: "create", label: "Create", icon: Plus },
  { id: "my-markets", label: "My Markets", icon: User },
  { id: "my-bets", label: "My Bets", icon: TrendingUp },
];

interface MyBetsViewProps {
  address: `0x${string}`;
  onSelectMarket: (market: MarketData) => void;
}

const MyBetsView = ({ address, onSelectMarket }: MyBetsViewProps) => {
  const { getAllMarkets, getTotalMarkets, hasBetOnMarket } = useMarket();
  const { refreshTrigger } = useMarketStore();

  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMyBets = useCallback(async () => {
    setIsLoading(true);
    try {
      const total = await getTotalMarkets();
      const allMarkets = await getAllMarkets(BigInt(0), Number(total));

      const betChecks = await Promise.all(
        allMarkets.map(async (market) => ({
          market,
          hasBet: await hasBetOnMarket(market.id, address),
        }))
      );

      const myBets = betChecks
        .filter(({ hasBet }) => hasBet)
        .map(({ market }) => market);

      myBets.sort((a, b) => (a.id > b.id ? -1 : a.id < b.id ? 1 : 0));
      setMarkets(myBets);
    } catch (error) {
      console.error("Failed to load bets:", error);
    } finally {
      setIsLoading(false);
    }
  }, [address, getAllMarkets, getTotalMarkets, hasBetOnMarket]);

  useEffect(() => { loadMyBets(); }, [loadMyBets, refreshTrigger]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-base-content/70 font-display uppercase tracking-wide">Loading your bets...</p>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border border-base-300 bg-base-200">
        <TrendingUp className="w-12 h-12 text-base-content/30 mb-4" />
        <p className="text-base-content/70 font-display uppercase tracking-wide mb-2">No bets placed yet</p>
        <p className="text-sm text-base-content/50">Browse markets and place your first encrypted bet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {markets.map((market) => (
        <MarketCard key={market.id.toString()} market={market} onClick={() => onSelectMarket(market)} />
      ))}
    </div>
  );
};

export const MarketsPage = () => {
  const { address } = useAccount();
  const { marketSubTab, setMarketSubTab, selectedMarketId, setSelectedMarketId } = useMarketStore();

  const handleSelectMarket = (market: MarketData) => setSelectedMarketId(market.id);
  const handleBack = () => setSelectedMarketId(null);

  if (selectedMarketId !== null) {
    return <MarketDetail marketId={selectedMarketId} onBack={handleBack} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-base-300 pb-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = marketSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setMarketSubTab(tab.id)}
              className={`btn btn-sm gap-2 font-display uppercase tracking-wide ${isActive ? "btn-primary" : "btn-ghost"}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        {marketSubTab === "browse" && <MarketList onSelectMarket={handleSelectMarket} />}
        {marketSubTab === "create" && <CreateMarketForm />}
        {marketSubTab === "my-markets" && (
          address ? (
            <MarketList filterCreator={address} onSelectMarket={handleSelectMarket} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 border border-base-300 bg-base-200">
              <User className="w-12 h-12 text-base-content/30 mb-4" />
              <p className="text-base-content/70 font-display uppercase tracking-wide mb-2">Connect wallet</p>
              <p className="text-sm text-base-content/50">Connect your wallet to view your markets</p>
            </div>
          )
        )}
        {marketSubTab === "my-bets" && (
          address ? (
            <MyBetsView address={address} onSelectMarket={handleSelectMarket} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 border border-base-300 bg-base-200">
              <TrendingUp className="w-12 h-12 text-base-content/30 mb-4" />
              <p className="text-base-content/70 font-display uppercase tracking-wide mb-2">Connect wallet</p>
              <p className="text-sm text-base-content/50">Connect your wallet to view your bets</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};