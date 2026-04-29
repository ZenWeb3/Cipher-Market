"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { Search, Plus, User, Gavel, Loader2 } from "lucide-react";
import { AuctionList } from "./AuctionList";
import { AuctionDetail } from "./AuctionDetail";
import { CreateAuctionForm } from "./CreateAuctionForm";
import { AuctionCard } from "./AuctionCard";
import { useAuction } from "@/hooks/useAuction";
import { useAuctionStore, AuctionSubTab } from "@/services/store/auctionStore";
import { AuctionData } from "@/utils/auctionContracts";

/**
 * Tab configuration for the auction page
 */
const TABS: { id: AuctionSubTab; label: string; icon: typeof Search }[] = [
  { id: "browse", label: "Browse Auctions", icon: Search },
  { id: "create", label: "Create Auction", icon: Plus },
  { id: "my-auctions", label: "My Auctions", icon: User },
  { id: "my-bids", label: "My Bids", icon: Gavel },
];

/**
 * Sub-component for displaying auctions the user has bid on
 */
interface MyBidsViewProps {
  address: `0x${string}`;
  onSelectAuction: (auction: AuctionData) => void;
}

const MyBidsView = ({ address, onSelectAuction }: MyBidsViewProps) => {
  const { getAllAuctions, getTotalAuctions, hasBidOnAuction } = useAuction();
  const { refreshTrigger } = useAuctionStore();

  const [auctions, setAuctions] = useState<AuctionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMyBids = useCallback(async () => {
    setIsLoading(true);

    try {
      // Get all auctions
      const totalAuctions = await getTotalAuctions();
      const allAuctions = await getAllAuctions(BigInt(0), Number(totalAuctions));

      // Check all bids in parallel to eliminate waterfall
      const bidChecks = await Promise.all(
        allAuctions.map(async (auction) => ({
          auction,
          hasBid: await hasBidOnAuction(auction.id, address),
        }))
      );

      // Filter to auctions user has bid on
      const myBidAuctions = bidChecks
        .filter(({ hasBid }) => hasBid)
        .map(({ auction }) => auction);

      // Sort by ID descending (newest first)
      myBidAuctions.sort((a, b) => {
        if (a.id > b.id) return -1;
        if (a.id < b.id) return 1;
        return 0;
      });

      setAuctions(myBidAuctions);
    } catch (error) {
      console.error("Failed to load my bids:", error);
    } finally {
      setIsLoading(false);
    }
  }, [address, getAllAuctions, getTotalAuctions, hasBidOnAuction]);

  useEffect(() => {
    loadMyBids();
  }, [loadMyBids, refreshTrigger]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-base-content/70 font-display uppercase tracking-wide">
          Loading your bids...
        </p>
      </div>
    );
  }

  // Empty state
  if (auctions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border border-base-300 bg-base-200">
        <Gavel className="w-12 h-12 text-base-content/30 mb-4" />
        <p className="text-base-content/70 font-display uppercase tracking-wide mb-2">
          No bids placed yet
        </p>
        <p className="text-sm text-base-content/50">
          Browse auctions and place your first bid
        </p>
      </div>
    );
  }

  // Auction grid
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {auctions.map((auction) => (
        <AuctionCard
          key={auction.id.toString()}
          auction={auction}
          onClick={() => onSelectAuction(auction)}
        />
      ))}
    </div>
  );
};

/**
 * Main page component that orchestrates the auction UI
 * Handles tab navigation and auction selection
 */
export const AuctionsPage = () => {
  const { address } = useAccount();
  const { auctionSubTab, setAuctionSubTab, selectedAuctionId, setSelectedAuctionId } =
    useAuctionStore();

  /**
   * Handle selecting an auction to view details
   */
  const handleSelectAuction = (auction: AuctionData) => {
    setSelectedAuctionId(auction.id);
  };

  /**
   * Handle going back from auction detail view
   */
  const handleBack = () => {
    setSelectedAuctionId(null);
  };

  // If an auction is selected, show the detail view
  if (selectedAuctionId !== null) {
    return <AuctionDetail auctionId={selectedAuctionId} onBack={handleBack} />;
  }

  // Otherwise, show the tabs UI
  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs */}
      <div className="flex flex-wrap gap-2 border-b border-base-300 pb-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = auctionSubTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setAuctionSubTab(tab.id)}
              className={`btn btn-sm gap-2 font-display uppercase tracking-wide ${
                isActive ? "btn-primary" : "btn-ghost"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {/* Browse Auctions tab */}
        {auctionSubTab === "browse" && (
          <AuctionList onSelectAuction={handleSelectAuction} />
        )}

        {/* Create Auction tab */}
        {auctionSubTab === "create" && <CreateAuctionForm />}

        {/* My Auctions tab */}
        {auctionSubTab === "my-auctions" && (
          <>
            {address ? (
              <AuctionList
                filterSeller={address}
                onSelectAuction={handleSelectAuction}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 border border-base-300 bg-base-200">
                <User className="w-12 h-12 text-base-content/30 mb-4" />
                <p className="text-base-content/70 font-display uppercase tracking-wide mb-2">
                  Connect wallet
                </p>
                <p className="text-sm text-base-content/50">
                  Please connect your wallet to view your auctions
                </p>
              </div>
            )}
          </>
        )}

        {/* My Bids tab */}
        {auctionSubTab === "my-bids" && (
          <>
            {address ? (
              <MyBidsView address={address} onSelectAuction={handleSelectAuction} />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 border border-base-300 bg-base-200">
                <Gavel className="w-12 h-12 text-base-content/30 mb-4" />
                <p className="text-base-content/70 font-display uppercase tracking-wide mb-2">
                  Connect wallet
                </p>
                <p className="text-sm text-base-content/50">
                  Please connect your wallet to view your bids
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
