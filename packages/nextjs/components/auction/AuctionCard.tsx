"use client";

import { useState, useEffect } from "react";
import { Clock, Users, Gavel } from "lucide-react";
import {
  AuctionData,
  AuctionStatus,
  SettlementResult,
  getEffectiveStatus,
  getEffectiveStatusColor,
  getEffectiveStatusLabel,
  getAuctionDisplayTitle,
} from "@/utils/auctionContracts";

interface AuctionCardProps {
  auction: AuctionData;
  onClick?: () => void;
  showActions?: boolean;
  settlementResult?: SettlementResult | null;
}

/**
 * Format an address for display (truncated)
 */
function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Calculate and format the time remaining or elapsed
 */
function getTimeDisplay(auction: AuctionData): { label: string; value: string } {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const startTime = auction.startTime;
  const endTime = auction.endTime;

  // Auction hasn't started yet
  if (now < startTime) {
    const secondsUntilStart = Number(startTime - now);
    return {
      label: "Starts in",
      value: formatDuration(secondsUntilStart),
    };
  }

  // Auction is active (use effective status to account for time)
  const effectiveStatus = getEffectiveStatus(auction);
  if (now < endTime && effectiveStatus === AuctionStatus.Active) {
    const secondsUntilEnd = Number(endTime - now);
    return {
      label: "Ends in",
      value: formatDuration(secondsUntilEnd),
    };
  }

  // Auction has ended
  return {
    label: "Ended",
    value: formatTimeSince(Number(now - endTime)),
  };
}

/**
 * Format a duration in seconds to a human-readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * Format time since an event occurred
 */
function formatTimeSince(seconds: number): string {
  if (seconds < 60) {
    return "just now";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const AuctionCard = ({
  auction,
  onClick,
  showActions = false,
  settlementResult,
}: AuctionCardProps) => {
  // Force re-render every second to update time display and status
  const [, setTick] = useState(0);

  useEffect(() => {
    const effectiveStatus = getEffectiveStatus(auction);
    // Only set up interval if auction is still active or pending
    if (effectiveStatus === AuctionStatus.Active || Date.now() / 1000 < Number(auction.startTime)) {
      const interval = setInterval(() => {
        setTick((t) => t + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [auction]);

  const timeDisplay = getTimeDisplay(auction);
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={`bg-base-200 border border-base-300 p-5 transition-colors ${
        isClickable
          ? "cursor-pointer hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          : ""
      }`}
    >
      {/* Header: Auction ID and Status Badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 border border-primary/30">
            <Gavel className="w-5 h-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-lg font-display font-bold text-base-content uppercase tracking-wide">
              {getAuctionDisplayTitle(auction)}
            </h3>
            {auction.name && (
              <span className="text-xs text-base-content/50 font-mono">
                #{auction.id.toString()}
              </span>
            )}
          </div>
        </div>
        <span
          className={`badge ${getEffectiveStatusColor(auction)} badge-sm font-display uppercase tracking-wide`}
        >
          {getEffectiveStatusLabel(auction)}
        </span>
      </div>

      {/* NFT Details */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-pixel text-base-content/50 uppercase tracking-widest">
            Token ID:
          </span>
          <span className="text-sm font-mono text-base-content">
            {auction.tokenId.toString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-pixel text-base-content/50 uppercase tracking-widest">
            NFT Contract:
          </span>
          <span className="text-sm font-mono text-base-content">
            {truncateAddress(auction.nftContract)}
          </span>
        </div>
      </div>

      {/* Stats Row: Bids and Time */}
      <div className="flex items-center justify-between py-3 border-t border-base-300">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-mono text-base-content">
            {auction.totalBids.toString()}
          </span>
          <span className="text-xs text-base-content/50">
            {auction.totalBids === BigInt(1) ? "bid" : "bids"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-xs text-base-content/50">{timeDisplay.label}:</span>
          <span className="text-sm font-mono text-base-content">
            {timeDisplay.value}
          </span>
        </div>
      </div>

      {/* Seller */}
      <div className="pt-3 border-t border-base-300">
        <div className="flex items-center gap-2">
          <span className="text-xs font-pixel text-base-content/50 uppercase tracking-widest">
            Seller:
          </span>
          <span className="text-sm font-mono text-base-content">
            {truncateAddress(auction.seller)}
          </span>
        </div>
      </div>

      {/* Winner (shown only for settled auctions) */}
      {auction.status === AuctionStatus.Settled && settlementResult && (
        <div className="pt-3 border-t border-base-300">
          <div className="flex items-center gap-2">
            <span className="text-xs font-pixel text-success uppercase tracking-widest">
              Winner:
            </span>
            <span className="text-sm font-mono text-success">
              {truncateAddress(settlementResult.winner)}
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="pt-4 mt-4 border-t border-base-300">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
            className="btn btn-fhenix btn-sm w-full font-display uppercase tracking-wide"
          >
            View Details
          </button>
        </div>
      )}
    </div>
  );
};
