"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, RefreshCw, Filter } from "lucide-react";
import { AuctionCard } from "./AuctionCard";
import { AuctionDetailModal } from "./AuctionDetailModal";
import { useAuction } from "@/hooks/useAuction";
import { useAuctionStore } from "@/services/store/auctionStore";
import {
  AuctionData,
  AuctionStatus,
  SettlementResult,
  getStatusLabel,
} from "@/utils/auctionContracts";

interface AuctionListProps {
  filterStatus?: AuctionStatus[];
  filterSeller?: `0x${string}`;
  onSelectAuction?: (auction: AuctionData) => void;
}

// Status filter options for the dropdown
const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: String(AuctionStatus.Active), label: getStatusLabel(AuctionStatus.Active) },
  { value: String(AuctionStatus.Ended), label: getStatusLabel(AuctionStatus.Ended) },
  { value: String(AuctionStatus.SettlementRequested), label: getStatusLabel(AuctionStatus.SettlementRequested) },
  { value: String(AuctionStatus.Settled), label: getStatusLabel(AuctionStatus.Settled) },
  { value: String(AuctionStatus.Cancelled), label: getStatusLabel(AuctionStatus.Cancelled) },
];

export const AuctionList = ({
  filterStatus,
  filterSeller,
  onSelectAuction,
}: AuctionListProps) => {
  const { getAllAuctions, getTotalAuctions, getSettlementResult } = useAuction();
  const { refreshTrigger, isLoadingAuctions, setIsLoadingAuctions } = useAuctionStore();

  const [auctions, setAuctions] = useState<AuctionData[]>([]);
  const [settlementResults, setSettlementResults] = useState<Record<string, SettlementResult>>({});
  const [uiStatusFilter, setUiStatusFilter] = useState<string>(String(AuctionStatus.Active));
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedAuction, setSelectedAuction] = useState<AuctionData | null>(null);

  // Shared auction loading logic
  const loadAuctions = useCallback(async (isInitial = false) => {
    setIsLoadingAuctions(true);

    try {
      const totalAuctions = await getTotalAuctions();
      const fetchedAuctions = await getAllAuctions(BigInt(0), Number(totalAuctions));
      setAuctions(fetchedAuctions);

      // Fetch settlement results for settled auctions in parallel
      const settledAuctions = fetchedAuctions.filter(a => a.status === AuctionStatus.Settled);
      const results: Record<string, SettlementResult> = {};

      await Promise.all(
        settledAuctions.map(async (auction) => {
          const result = await getSettlementResult(auction.id);
          if (result) {
            results[auction.id.toString()] = result;
          }
        })
      );

      setSettlementResults(results);
    } catch (error) {
      console.error("Failed to load auctions:", error);
    } finally {
      setIsLoadingAuctions(false);
      if (isInitial) {
        setIsInitialLoad(false);
      }
    }
  }, [getAllAuctions, getTotalAuctions, getSettlementResult, setIsLoadingAuctions]);

  // Load auctions on mount and when refreshTrigger changes
  useEffect(() => {
    loadAuctions(true);
  }, [refreshTrigger, loadAuctions]);

  // Handle manual refresh
  const handleRefresh = useCallback(() => {
    if (isLoadingAuctions) return;
    loadAuctions(false);
  }, [isLoadingAuctions, loadAuctions]);

  // Filter and sort auctions
  const filteredAuctions = useMemo(() => {
    let result = [...auctions];

    // Apply prop filterStatus if provided
    if (filterStatus && filterStatus.length > 0) {
      result = result.filter((auction) => filterStatus.includes(auction.status));
    }

    // Apply prop filterSeller if provided
    if (filterSeller) {
      result = result.filter(
        (auction) => auction.seller.toLowerCase() === filterSeller.toLowerCase()
      );
    }

    // Apply UI status filter
    if (uiStatusFilter !== "all") {
      const statusValue = parseInt(uiStatusFilter, 10) as AuctionStatus;
      result = result.filter((auction) => auction.status === statusValue);
    }

    // Sort by ID descending (newest first)
    result.sort((a, b) => {
      if (a.id > b.id) return -1;
      if (a.id < b.id) return 1;
      return 0;
    });

    return result;
  }, [auctions, filterStatus, filterSeller, uiStatusFilter]);

  // Show loading spinner during initial load
  if (isInitialLoad && isLoadingAuctions) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-base-content/70 font-display uppercase tracking-wide">
          Loading auctions...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filter and refresh */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Status filter dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-base-content/50" />
          <select
            value={uiStatusFilter}
            onChange={(e) => setUiStatusFilter(e.target.value)}
            className="select select-bordered select-sm font-display uppercase tracking-wide"
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          disabled={isLoadingAuctions}
          className="btn btn-ghost btn-sm gap-2 font-display uppercase tracking-wide"
        >
          <RefreshCw
            className={`w-4 h-4 ${isLoadingAuctions ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* Empty state */}
      {filteredAuctions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 border border-base-300 bg-base-200">
          <p className="text-base-content/70 font-display uppercase tracking-wide mb-2">
            No auctions found
          </p>
          <p className="text-sm text-base-content/50">
            {uiStatusFilter !== "all"
              ? "Try changing the status filter"
              : "Check back later for new auctions"}
          </p>
        </div>
      )}

      {/* Auction grid */}
      {filteredAuctions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAuctions.map((auction) => (
            <AuctionCard
              key={auction.id.toString()}
              auction={auction}
              settlementResult={settlementResults[auction.id.toString()]}
              onClick={() => {
                setSelectedAuction(auction);
                onSelectAuction?.(auction);
              }}
            />
          ))}
        </div>
      )}

      {selectedAuction && (
        <AuctionDetailModal
          auction={selectedAuction}
          isOpen={!!selectedAuction}
          onClose={() => setSelectedAuction(null)}
        />
      )}
    </div>
  );
};
