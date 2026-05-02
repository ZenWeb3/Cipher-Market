"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { MarketCard } from "./MarketCard";
import { useMarket } from "@/hooks/useMarket";
import { useMarketStore } from "@/services/store/marketStore";
import { MarketData } from "@/utils/marketContracts";
import { usePublicClient } from "wagmi";

interface MarketListProps {
  filterCreator?: `0x${string}`;
  onSelectMarket: (market: MarketData) => void;
}

export const MarketList = ({ filterCreator, onSelectMarket }: MarketListProps) => {
  const { getAllMarkets, getTotalMarkets } = useMarket();
  const { refreshTrigger } = useMarketStore();

  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMarkets = useCallback(async () => {
    setIsLoading(true);
    try {
      const total = await getTotalMarkets();
      const allMarkets = await getAllMarkets(BigInt(0), Number(total));

      let filtered = allMarkets;
      if (filterCreator) {
        filtered = allMarkets.filter(
          (m) => m.creator.toLowerCase() === filterCreator.toLowerCase()
        );
      }

      filtered.sort((a, b) => {
        if (a.id > b.id) return -1;
        if (a.id < b.id) return 1;
        return 0;
      });

      setMarkets(filtered);
    } catch (error) {
      console.error("Failed to load markets:", error);
    } finally {
      setIsLoading(false);
    }
  }, [getAllMarkets, getTotalMarkets, filterCreator]);

  const publicClient = usePublicClient();

  useEffect(() => {
    if (publicClient) {
      loadMarkets();
    } else {
      setIsLoading(false);
    }
  }, [loadMarkets, refreshTrigger, publicClient]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-base-content/70 font-display uppercase tracking-wide">
          Loading markets...
        </p>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border border-base-300 bg-base-200">
        <TrendingUp className="w-12 h-12 text-base-content/30 mb-4" />
        <p className="text-base-content/70 font-display uppercase tracking-wide mb-2">
          {publicClient ? "No markets yet" : "Connect your wallet"}
        </p>
        <p className="text-sm text-base-content/50">
          {publicClient
            ? "Create the first prediction market"
            : "Connect your wallet to browse prediction markets"}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {markets.map((market) => (
        <MarketCard
          key={market.id.toString()}
          market={market}
          onClick={() => onSelectMarket(market)}
        />
      ))}
    </div>
  );
};