"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAccount } from "wagmi";
import { FheTypes } from "@cofhe/sdk";
import { cofheClient } from "@/services/cofhe-client";
import {
  ArrowLeft,
  Clock,
  Users,
  Gavel,
  CheckCircle,
  XCircle,
  Loader2,
  Trophy,
  Banknote,
  RefreshCw,
  Eye,
  ExternalLink,
  PartyPopper,
  Gift,
} from "lucide-react";
import { PlaceBidModal } from "./PlaceBidModal";
import { useAuction } from "@/hooks/useAuction";
import {
  AuctionData,
  AuctionStatus,
  SettlementResult,
  getEffectiveStatus,
  getEffectiveStatusColor,
  getEffectiveStatusLabel,
  getAuctionDisplayTitle,
} from "@/utils/auctionContracts";
import { getExplorerTxUrl } from "@/utils/explorerLink";

interface AuctionDetailProps {
  auctionId: bigint;
  onBack: () => void;
}

/**
 * Format an address for display (truncated)
 */
function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format token amount (6 decimals) to display string
 */
function formatTokenAmount(amount: bigint): string {
  const divisor = BigInt(1_000_000);
  const integerPart = amount / divisor;
  const fractionalPart = amount % divisor;
  const fractionalStr = fractionalPart.toString().padStart(6, "0");
  return `${integerPart}.${fractionalStr}`;
}

/**
 * Get bid transaction hash from localStorage
 */
function getBidTxHash(auctionId: bigint, bidder: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const bidTxHashes = JSON.parse(localStorage.getItem("bidTxHashes") || "{}");
    const key = `${auctionId.toString()}-${bidder.toLowerCase()}`;
    return bidTxHashes[key] || null;
  } catch {
    return null;
  }
}

/**
 * Check if the winner celebration modal has been shown for this auction
 */
function hasSeenWinnerModal(auctionId: bigint, winner: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const seenModals = JSON.parse(localStorage.getItem("winnerModalsSeen") || "{}");
    const key = `${auctionId.toString()}-${winner.toLowerCase()}`;
    return seenModals[key] === true;
  } catch {
    return true;
  }
}

/**
 * Mark the winner celebration modal as seen for this auction
 */
function markWinnerModalSeen(auctionId: bigint, winner: string): void {
  if (typeof window === "undefined") return;
  try {
    const seenModals = JSON.parse(localStorage.getItem("winnerModalsSeen") || "{}");
    const key = `${auctionId.toString()}-${winner.toLowerCase()}`;
    seenModals[key] = true;
    localStorage.setItem("winnerModalsSeen", JSON.stringify(seenModals));
  } catch {
    console.error("Failed to save winner modal state to localStorage");
  }
}

/**
 * Detailed view of a single auction with actions
 */
type SettlementStep = "request" | "finalize";

export const AuctionDetail = ({ auctionId, onBack }: AuctionDetailProps) => {
  const { address } = useAccount();
  const {
    getAuction,
    hasBidOnAuction,
    hasClaimedRefund,
    getSettlementResult,
    requestSettlement,
    finalizeSettlement,
    getBidderDeposit,
    claimRefund,
    cancelAuction,
    isLoading,
  } = useAuction();

  // State
  const [auction, setAuction] = useState<AuctionData | null>(null);
  const [userHasBid, setUserHasBid] = useState(false);
  const [userHasRefunded, setUserHasRefunded] = useState(false);
  const [settlementResult, setSettlementResult] = useState<SettlementResult | null>(null);
  const [showBidModal, setShowBidModal] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Settlement flow state
  const [settlementStep, setSettlementStep] = useState<SettlementStep>("request");

  // Bid amount state for the current user
  const [userBidAmount, setUserBidAmount] = useState<bigint | null>(null);
  const [isUnsealingBid, setIsUnsealingBid] = useState(false);
  const [bidRevealed, setBidRevealed] = useState(false);

  // Winner celebration modal state
  const [showWinnerModal, setShowWinnerModal] = useState(false);

  // Timer tick for real-time status updates
  const [tick, setTick] = useState(0);

  /**
   * Load all auction data
   */
  const loadAuctionData = useCallback(async () => {
    setIsLoadingData(true);

    try {
      // Load auction details
      const auctionData = await getAuction(auctionId);
      setAuction(auctionData);

      if (!auctionData) {
        return;
      }

      // Load user-specific data if connected
      if (address) {
        const [hasBid, hasRefund] = await Promise.all([
          hasBidOnAuction(auctionId, address),
          hasClaimedRefund(auctionId, address),
        ]);
        setUserHasBid(hasBid);
        setUserHasRefunded(hasRefund);
      }

      // Load settlement result if settled
      if (auctionData.status === AuctionStatus.Settled) {
        const result = await getSettlementResult(auctionId);
        setSettlementResult(result);
      }

      // With the new cofhe-sdk flow, decryption happens off-chain during finalize
      // — no polling needed. Go straight to "finalize" when a settlement has
      // already been requested.
      if (auctionData.status === AuctionStatus.SettlementRequested) {
        setSettlementStep("finalize");
      } else if (auctionData.status === AuctionStatus.Active) {
        setSettlementStep("request");
      }
    } catch (error) {
      console.error("Failed to load auction data:", error);
    } finally {
      setIsLoadingData(false);
    }
  }, [auctionId, address, getAuction, hasBidOnAuction, hasClaimedRefund, getSettlementResult]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadAuctionData();
  }, [loadAuctionData]);

  // Timer for real-time status updates (every second when auction is active)
  useEffect(() => {
    if (!auction) return;

    const effectiveStatus = getEffectiveStatus(auction);
    // Only set up interval if auction is still active or pending start
    if (effectiveStatus === AuctionStatus.Active || Date.now() / 1000 < Number(auction.startTime)) {
      const interval = setInterval(() => {
        setTick((t) => t + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [auction]);

  // Show winner celebration modal when winner visits for the first time
  useEffect(() => {
    if (
      settlementResult &&
      address &&
      settlementResult.winner.toLowerCase() === address.toLowerCase() &&
      !hasSeenWinnerModal(auctionId, address)
    ) {
      setShowWinnerModal(true);
    }
  }, [settlementResult, address, auctionId]);

  /**
   * Handle refresh button click
   */
  const handleRefresh = () => {
    loadAuctionData();
  };

  /**
   * Handle request settlement action
   */
  const handleRequestSettlement = async () => {
    const success = await requestSettlement(auctionId);
    if (success) {
      setSettlementStep("finalize");
      loadAuctionData();
    }
  };

  /**
   * Handle finalize settlement action
   */
  const handleFinalizeSettlement = async () => {
    const success = await finalizeSettlement(auctionId);
    if (success) {
      loadAuctionData();
    }
  };

  /**
   * Handle claim refund action
   */
  const handleClaimRefund = async () => {
    const success = await claimRefund(auctionId);
    if (success) {
      loadAuctionData();
    }
  };

  /**
   * Handle cancel auction action
   */
  const handleCancelAuction = async () => {
    const success = await cancelAuction(auctionId);
    if (success) {
      loadAuctionData();
    }
  };

  /**
   * Handle bid modal close
   */
  const handleBidModalClose = () => {
    setShowBidModal(false);
    loadAuctionData();
  };

  /**
   * Handle winner celebration modal close
   */
  const handleWinnerModalClose = () => {
    if (address) {
      markWinnerModalSeen(auctionId, address);
    }
    setShowWinnerModal(false);
  };

  /**
   * Reveal the user's bid amount by unsealing the encrypted value
   */
  const handleRevealBid = async () => {
    if (!address || !userHasBid) return;

    setIsUnsealingBid(true);
    try {
      // Get the encrypted bid hash from the contract (bytes32 in the new FHERC20)
      const ctHash = await getBidderDeposit(auctionId, address);

      if (!ctHash || /^0x0+$/.test(ctHash)) {
        console.error("No bid deposit found");
        setIsUnsealingBid(false);
        return;
      }

      // Decrypt the bid amount using the user's active permit via @cofhe/sdk
      const plaintext = await cofheClient
        .decryptForView(ctHash, FheTypes.Uint64)
        .execute();

      setUserBidAmount(BigInt(plaintext.toString()));
      setBidRevealed(true);
    } catch (error) {
      console.error("Error revealing bid:", error);
    } finally {
      setIsUnsealingBid(false);
    }
  };

  // Derived state - memoized to prevent unnecessary recalculations
  const derivedState = useMemo(() => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const isSeller = auction && address ? auction.seller.toLowerCase() === address.toLowerCase() : false;
    const isWinner = settlementResult && address ? settlementResult.winner.toLowerCase() === address.toLowerCase() : false;
    const isAuctionEnded = auction ? now >= auction.endTime : false;
    const isAuctionActive = auction ? auction.status === AuctionStatus.Active : false;

    // Determine which action buttons to show
    const showPlaceBid = auction && isAuctionActive && !isAuctionEnded && !userHasBid && !isSeller;

    // Show settlement flow for seller when auction has ended with bids
    const showSettlementFlow =
      auction &&
      isSeller &&
      isAuctionEnded &&
      auction.totalBids > BigInt(0) &&
      auction.status !== AuctionStatus.Settled &&
      auction.status !== AuctionStatus.Cancelled;

    const showClaimRefund =
      auction &&
      auction.status === AuctionStatus.Settled &&
      userHasBid &&
      !userHasRefunded &&
      !isWinner;

    const showCancelAuction = auction && isSeller && isAuctionActive && auction.totalBids === BigInt(0);

    return {
      isSeller,
      isWinner,
      isAuctionEnded,
      isAuctionActive,
      showPlaceBid,
      showSettlementFlow,
      showClaimRefund,
      showCancelAuction,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auction, address, settlementResult, userHasBid, userHasRefunded, tick]);

  const { isSeller, isWinner, showPlaceBid, showSettlementFlow, showClaimRefund, showCancelAuction } = derivedState;

  // Loading state
  if (isLoadingData && !auction) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-base-content/70 font-display uppercase tracking-wide">
          Loading auction details...
        </p>
      </div>
    );
  }

  // Auction not found
  if (!auction) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border border-base-300 bg-base-200">
        <XCircle className="w-12 h-12 text-error mb-4" />
        <p className="text-base-content/70 font-display uppercase tracking-wide mb-4">
          Auction not found
        </p>
        <button onClick={onBack} className="btn btn-ghost btn-sm font-display uppercase tracking-wide">
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="btn btn-ghost btn-sm font-display uppercase tracking-wide"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 border border-primary/30">
              <Gavel className="w-5 h-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-xl font-display font-bold text-base-content uppercase tracking-wide">
                {auction ? getAuctionDisplayTitle(auction) : `Auction #${auctionId.toString()}`}
              </h2>
              {auction?.name && (
                <span className="text-xs text-base-content/50 font-mono">
                  #{auctionId.toString()}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isLoadingData}
            className="btn btn-ghost btn-sm gap-2 font-display uppercase tracking-wide"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingData ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <span
            className={`badge ${getEffectiveStatusColor(auction)} badge-md font-display uppercase tracking-wide`}
          >
            {getEffectiveStatusLabel(auction)}
          </span>
        </div>
      </div>

      {/* Main content - 3 column grid on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* NFT Details Card */}
          <div className="bg-base-200 border border-base-300 p-5">
            <h3 className="text-sm font-display uppercase tracking-widest text-base-content/50 mb-4">
              NFT Details
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-pixel text-base-content/50 uppercase tracking-widest">
                  NFT Contract:
                </span>
                <span className="text-sm font-mono text-base-content">
                  {truncateAddress(auction.nftContract)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-pixel text-base-content/50 uppercase tracking-widest">
                  Token ID:
                </span>
                <span className="text-sm font-mono text-base-content">
                  {auction.tokenId.toString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-pixel text-base-content/50 uppercase tracking-widest">
                  Seller:
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-base-content">
                    {truncateAddress(auction.seller)}
                  </span>
                  {isSeller && (
                    <span className="badge badge-primary badge-xs font-display uppercase">You</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Timing Card */}
          <div className="bg-base-200 border border-base-300 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-display uppercase tracking-widest text-base-content/50">
                Timing
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-pixel text-base-content/50 uppercase tracking-widest">
                  Start Time:
                </span>
                <span className="text-sm font-mono text-base-content">
                  {new Date(Number(auction.startTime) * 1000).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-pixel text-base-content/50 uppercase tracking-widest">
                  End Time:
                </span>
                <span className="text-sm font-mono text-base-content">
                  {new Date(Number(auction.endTime) * 1000).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Settlement Result Card (only if settled) */}
          {auction.status === AuctionStatus.Settled && settlementResult && (
            <div className="bg-base-200 border border-primary/30 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-display uppercase tracking-widest text-primary">
                  Settlement Result
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-pixel text-base-content/50 uppercase tracking-widest">
                    Winner:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-base-content">
                      {truncateAddress(settlementResult.winner)}
                    </span>
                    {isWinner && (
                      <span className="badge badge-success badge-xs font-display uppercase">You</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-pixel text-base-content/50 uppercase tracking-widest">
                    Winning Bid:
                  </span>
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-success" />
                    <span className="text-sm font-mono text-success font-bold">
                      {formatTokenAmount(settlementResult.amount)} tokens
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column (1/3 width) */}
        <div className="space-y-6">
          {/* Bid Stats Card */}
          <div className="bg-base-200 border border-base-300 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-display uppercase tracking-widest text-base-content/50">
                Bid Stats
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-pixel text-base-content/50 uppercase tracking-widest">
                  Total Bids:
                </span>
                <span className="text-lg font-mono text-base-content font-bold">
                  {auction.totalBids.toString()}
                </span>
              </div>
              {userHasBid && (
                <div className="pt-2 border-t border-base-300 space-y-2">
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-display uppercase tracking-wide">
                      You have placed a bid
                    </span>
                  </div>

                  {/* View bid on block explorer */}
                  {address && getBidTxHash(auctionId, address) && (
                    <a
                      href={getExplorerTxUrl(getBidTxHash(auctionId, address)!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View encrypted bid on Arbiscan
                    </a>
                  )}

                  {/* Reveal bid amount */}
                  {!bidRevealed ? (
                    <button
                      onClick={handleRevealBid}
                      disabled={isUnsealingBid}
                      className="btn btn-ghost btn-sm w-full gap-2 text-primary"
                    >
                      {isUnsealingBid ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                      {isUnsealingBid ? "Decrypting..." : "Reveal My Bid"}
                    </button>
                  ) : (
                    <div className="flex items-center justify-between bg-primary/10 p-2 rounded-sm">
                      <div className="flex items-center gap-2">
                        <Banknote className="w-4 h-4 text-primary" />
                        <span className="text-xs font-pixel text-base-content/50 uppercase">
                          Your Bid:
                        </span>
                      </div>
                      <span className="text-sm font-mono text-primary font-bold">
                        {userBidAmount !== null ? formatTokenAmount(userBidAmount) : "?"} AUCT
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons Card */}
          {(showPlaceBid || showSettlementFlow || showClaimRefund || showCancelAuction) && (
            <div className="bg-base-200 border border-base-300 p-5">
              <h3 className="text-sm font-display uppercase tracking-widest text-base-content/50 mb-4">
                Actions
              </h3>
              <div className="space-y-3">
                {/* Place Bid Button */}
                {showPlaceBid && (
                  <button
                    onClick={() => setShowBidModal(true)}
                    disabled={isLoading}
                    className="btn btn-primary w-full font-display uppercase tracking-wide"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Gavel className="w-4 h-4" />
                    )}
                    Place Bid
                  </button>
                )}

                {/* Settlement Flow (2-step in the new cofhe-sdk: request → decrypt & finalize) */}
                {showSettlementFlow && (
                  <div className="space-y-3">
                    {/* Step indicator */}
                    <div className="flex items-center justify-between text-xs">
                      <span className={settlementStep === "request" ? "text-primary font-bold" : "text-success"}>
                        1. Request
                      </span>
                      <span className={settlementStep === "finalize" ? "text-primary font-bold" : "text-base-content/40"}>
                        2. Decrypt & Finalize
                      </span>
                    </div>

                    {/* Settlement button */}
                    {settlementStep === "request" && (
                      <button
                        onClick={handleRequestSettlement}
                        disabled={isLoading}
                        className="btn btn-success w-full font-display uppercase tracking-wide"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Request Settlement
                      </button>
                    )}

                    {settlementStep === "finalize" && (
                      <button
                        onClick={handleFinalizeSettlement}
                        disabled={isLoading}
                        className="btn btn-primary w-full font-display uppercase tracking-wide"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trophy className="w-4 h-4" />
                        )}
                        Decrypt & Finalize
                      </button>
                    )}
                  </div>
                )}

                {/* Claim Refund Button */}
                {showClaimRefund && (
                  <button
                    onClick={handleClaimRefund}
                    disabled={isLoading}
                    className="btn btn-info w-full font-display uppercase tracking-wide"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Banknote className="w-4 h-4" />
                    )}
                    Claim Refund
                  </button>
                )}

                {/* Cancel Auction Button */}
                {showCancelAuction && (
                  <button
                    onClick={handleCancelAuction}
                    disabled={isLoading}
                    className="btn btn-error w-full font-display uppercase tracking-wide"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Cancel Auction
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Place Bid Modal */}
      {auction && (
        <PlaceBidModal
          auction={auction}
          isOpen={showBidModal}
          onClose={handleBidModalClose}
        />
      )}

      {/* Winner Celebration Modal */}
      {showWinnerModal && settlementResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={handleWinnerModalClose}
        >
          <div
            className="relative bg-base-100 border border-primary p-8 w-full max-w-md mx-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary" />

            {/* Celebration icon */}
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-success/20 border-2 border-success rounded-full">
                <PartyPopper className="w-12 h-12 text-success" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-3xl font-display font-bold text-success uppercase tracking-wide mb-2">
              You Won!
            </h2>
            <p className="text-base-content/70 mb-6">
              Congratulations! You are the winner of this auction.
            </p>

            {/* Prize section */}
            <div className="bg-base-200 border border-base-300 p-4 mb-4">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Gift className="w-5 h-5 text-primary" />
                <span className="text-sm font-display uppercase tracking-widest text-base-content/50">
                  Your Prize
                </span>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-base-content/70">NFT Token ID</p>
                <p className="text-2xl font-mono text-primary font-bold">
                  #{auction.tokenId.toString()}
                </p>
              </div>
            </div>

            {/* Winning bid section */}
            <div className="bg-base-200 border border-base-300 p-4 mb-6">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-success" />
                <span className="text-sm font-display uppercase tracking-widest text-base-content/50">
                  Winning Bid
                </span>
              </div>
              <p className="text-2xl font-mono text-success font-bold">
                {formatTokenAmount(settlementResult.amount)} AUCT
              </p>
            </div>

            {/* Close button */}
            <button
              onClick={handleWinnerModalClose}
              className="btn btn-primary w-full font-display uppercase tracking-wide"
            >
              <CheckCircle className="w-4 h-4" />
              Awesome!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
