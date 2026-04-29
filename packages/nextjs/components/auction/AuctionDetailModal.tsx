"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { X, Clock, Users, Gavel, Trophy, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { useAuction } from "@/hooks/useAuction";
import {
  AuctionData,
  AuctionStatus,
  SettlementResult,
  getEffectiveStatus,
  getEffectiveStatusColor,
  getEffectiveStatusLabel,
} from "@/utils/auctionContracts";
import { PlaceBidModal } from "./PlaceBidModal";

interface AuctionDetailModalProps {
  auction: AuctionData;
  isOpen: boolean;
  onClose: () => void;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTimestamp(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

function formatDuration(startTime: bigint, endTime: bigint): string {
  const durationSeconds = Number(endTime - startTime);
  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""}`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

type SettlementStep = "request" | "finalize";

export const AuctionDetailModal = ({ auction: initialAuction, isOpen, onClose }: AuctionDetailModalProps) => {
  const { address } = useAccount();
  const {
    getAuction,
    hasBidOnAuction,
    hasClaimedRefund,
    getSettlementResult,
    requestSettlement,
    finalizeSettlement,
    claimRefund,
    cancelAuction,
    isLoading,
  } = useAuction();

  // Local auction state - starts with prop, but we refresh it after operations
  const [auction, setAuction] = useState<AuctionData>(initialAuction);

  const [userHasBid, setUserHasBid] = useState(false);
  const [userHasRefunded, setUserHasRefunded] = useState(false);
  const [settlementResult, setSettlementResult] = useState<SettlementResult | null>(null);
  const [showBidModal, setShowBidModal] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  // Settlement flow state - in the new cofhe-sdk: request -> decrypt & finalize
  const [settlementStep, setSettlementStep] = useState<SettlementStep>("request");
  const [settlementCompleted, setSettlementCompleted] = useState(false);

  const isSeller = address?.toLowerCase() === auction.seller.toLowerCase();
  const now = BigInt(Math.floor(Date.now() / 1000));
  const hasStarted = now >= auction.startTime;
  const hasEnded = now >= auction.endTime;
  const effectiveStatus = getEffectiveStatus(auction);
  const isActive = effectiveStatus === AuctionStatus.Active && hasStarted && !hasEnded;

  // Get the numeric status for comparisons
  const statusNum = Number(auction.status);

  // Refresh auction data from the chain
  const refreshAuction = useCallback(async () => {
    const freshAuction = await getAuction(auction.id);
    if (freshAuction) {
      setAuction(freshAuction);
    }
  }, [getAuction, auction.id]);

  // Sync with prop when modal opens with new auction
  useEffect(() => {
    setAuction(initialAuction);
  }, [initialAuction]);

  // Fetch fresh auction data and user status when modal opens
  useEffect(() => {
    const fetchStatus = async () => {
      if (!address || !isOpen) return;

      setIsCheckingStatus(true);

      // First, refresh auction data from the chain
      const freshAuction = await getAuction(initialAuction.id);
      if (freshAuction) {
        setAuction(freshAuction);
      }
      const auctionToUse = freshAuction || auction;
      const freshStatusNum = Number(auctionToUse.status);

      const [hasBid, hasRefund] = await Promise.all([
        hasBidOnAuction(auctionToUse.id, address),
        hasClaimedRefund(auctionToUse.id, address),
      ]);

      setUserHasBid(hasBid);
      setUserHasRefunded(hasRefund);

      if (freshStatusNum === AuctionStatus.Settled) {
        const result = await getSettlementResult(auctionToUse.id);
        setSettlementResult(result);
        setSettlementCompleted(true);
      }

      // With the new cofhe-sdk flow, decryption happens during finalize — no polling.
      if (freshStatusNum === AuctionStatus.SettlementRequested) {
        setSettlementStep("finalize");
      }

      setIsCheckingStatus(false);
    };

    fetchStatus();
  }, [address, initialAuction.id, isOpen, getAuction, hasBidOnAuction, hasClaimedRefund, getSettlementResult]);

  const handleRequestSettlement = async () => {
    const success = await requestSettlement(auction.id);
    if (success) {
      // Refresh auction data to get the new status
      await refreshAuction();
      setSettlementStep("finalize");
    }
  };

  const handleFinalizeSettlement = async () => {
    const success = await finalizeSettlement(auction.id);
    if (success) {
      setSettlementCompleted(true);
      onClose();
    }
  };

  const handleClaimRefund = async () => {
    const success = await claimRefund(auction.id);
    if (success) {
      onClose();
    }
  };

  const handleCancelAuction = async () => {
    const success = await cancelAuction(auction.id);
    if (success) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const isWinner = settlementResult?.winner.toLowerCase() === address?.toLowerCase();

  // Simplified conditions
  const canPlaceBid = isActive && !isSeller && !userHasBid;
  const showSettlementFlow = isSeller && hasEnded && auction.totalBids > BigInt(0) && statusNum !== AuctionStatus.Settled && statusNum !== AuctionStatus.Cancelled;
  const canClaimRefund = (statusNum === AuctionStatus.Settled || statusNum === AuctionStatus.Cancelled) && userHasBid && !userHasRefunded && !isWinner;
  const canCancel = isSeller && statusNum === AuctionStatus.Active && auction.totalBids === BigInt(0);

  // Settlement button logic
  const getSettlementButtonText = () => {
    if (isLoading) return "Processing...";
    if (settlementCompleted) return "Settlement Complete!";

    switch (settlementStep) {
      case "request":
        return "Request Settlement";
      case "finalize":
        return "Decrypt & Finalize";
    }
  };

  const isSettlementButtonDisabled = () => {
    if (isLoading || settlementCompleted) return true;
    return false;
  };

  const handleSettlementClick = () => {
    if (settlementStep === "request") {
      handleRequestSettlement();
    } else if (settlementStep === "finalize") {
      handleFinalizeSettlement();
    }
  };

  return (
    <>
      <div className="modal modal-open">
        <div className="modal-box max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 border border-primary/30">
                <Gavel className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-base-content uppercase tracking-wide">
                  Auction #{auction.id.toString()}
                </h3>
                <span className={`badge ${getEffectiveStatusColor(auction)} badge-sm font-display uppercase tracking-wide mt-1`}>
                  {getEffectiveStatusLabel(auction)}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-base-200 p-4 border border-base-300">
              <p className="text-xs font-pixel text-base-content/50 uppercase tracking-widest mb-1">NFT Token ID</p>
              <p className="text-lg font-mono">{auction.tokenId.toString()}</p>
            </div>
            <div className="bg-base-200 p-4 border border-base-300">
              <p className="text-xs font-pixel text-base-content/50 uppercase tracking-widest mb-1">Total Bids</p>
              <p className="text-lg font-mono flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                {auction.totalBids.toString()}
              </p>
            </div>
            <div className="bg-base-200 p-4 border border-base-300">
              <p className="text-xs font-pixel text-base-content/50 uppercase tracking-widest mb-1">Duration</p>
              <p className="text-lg font-mono flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                {formatDuration(auction.startTime, auction.endTime)}
              </p>
            </div>
            <div className="bg-base-200 p-4 border border-base-300">
              <p className="text-xs font-pixel text-base-content/50 uppercase tracking-widest mb-1">Seller</p>
              <p className="text-sm font-mono">{truncateAddress(auction.seller)}</p>
              {isSeller && <span className="badge badge-primary badge-xs mt-1">You</span>}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-base-200 p-4 border border-base-300 mb-6">
            <p className="text-xs font-pixel text-base-content/50 uppercase tracking-widest mb-2">Timeline</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-base-content/50">Start</p>
                <p className="font-mono">{formatTimestamp(auction.startTime)}</p>
              </div>
              <div>
                <p className="text-base-content/50">End</p>
                <p className="font-mono">{formatTimestamp(auction.endTime)}</p>
              </div>
            </div>
          </div>

          {/* Settlement Progress (for seller during settlement flow) */}
          {showSettlementFlow && (
            <div className="space-y-3 mb-6">
              <label className="text-sm font-pixel text-base-content/60 uppercase tracking-widest">
                Settlement Progress
              </label>
              <div className="relative flex items-center justify-between px-4">
                {/* Connector Line */}
                <div className="absolute top-4 left-[calc(25%)] right-[calc(25%)] h-0.5 bg-base-300">
                  <div
                    className={`absolute left-0 h-full transition-all duration-300 ${
                      settlementStep !== "request" || settlementCompleted ? "w-full bg-green-500" : "w-0"
                    }`}
                  />
                </div>

                {/* Step 1 - Request */}
                <div className="flex flex-col items-center gap-2 z-10">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                      settlementStep === "request" && !settlementCompleted
                        ? "bg-primary text-primary-content ring-4 ring-primary/20"
                        : "bg-green-500 text-white"
                    }`}
                  >
                    {settlementStep === "request" && !settlementCompleted ? (
                      <span className="text-xs font-bold">1</span>
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </div>
                  <span className={`text-xs font-medium ${
                    settlementStep === "request" && !settlementCompleted ? "text-primary" : "text-green-600"
                  }`}>Request</span>
                </div>

                {/* Step 2 - Decrypt & Finalize (combined in the new flow) */}
                <div className="flex flex-col items-center gap-2 z-10">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                      settlementCompleted
                        ? "bg-green-500 text-white"
                        : settlementStep === "finalize"
                          ? "bg-primary text-primary-content ring-4 ring-primary/20"
                          : "bg-base-300 text-base-content/40"
                    }`}
                  >
                    {settlementCompleted ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <span className="text-xs font-bold">2</span>
                    )}
                  </div>
                  <span className={`text-xs font-medium ${
                    settlementCompleted
                      ? "text-green-600"
                      : settlementStep === "finalize"
                        ? "text-primary"
                        : "text-base-content/60"
                  }`}>Decrypt & Finalize</span>
                </div>
              </div>

              {/* Ready to finalize */}
              {settlementStep === "finalize" && !settlementCompleted && (
                <div className="p-2 bg-green-500/10 border border-green-500/30 rounded-sm">
                  <p className="text-xs text-green-500">
                    Click &quot;Decrypt & Finalize&quot; — the winner and amount are decrypted off-chain and submitted on-chain in a single step.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Settlement Result (if settled) */}
          {statusNum === AuctionStatus.Settled && settlementResult && (
            <div className="bg-success/10 border border-success/30 p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-success" />
                <p className="text-sm font-display font-bold text-success uppercase tracking-wide">
                  Auction Settled
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-base-content/50">Winner</p>
                  <p className="font-mono">
                    {truncateAddress(settlementResult.winner)}
                    {isWinner && <span className="badge badge-success badge-xs ml-2">You</span>}
                  </p>
                </div>
                <div>
                  <p className="text-base-content/50">Winning Bid</p>
                  <p className="font-mono">{(Number(settlementResult.amount) / 1_000_000).toLocaleString()} AUCT</p>
                </div>
              </div>
            </div>
          )}

          {/* User Status */}
          {!isCheckingStatus && address && (
            <div className="mb-6">
              {userHasBid && (
                <div className="alert alert-info">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">You have placed a bid on this auction</span>
                </div>
              )}
              {userHasRefunded && (
                <div className="alert alert-success">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">You have claimed your refund</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="modal-action">
            {isCheckingStatus ? (
              <div className="flex items-center gap-2 text-base-content/50">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading...</span>
              </div>
            ) : (
              <>
                {canPlaceBid && (
                  <button
                    onClick={() => setShowBidModal(true)}
                    className="btn btn-primary font-display uppercase tracking-wide"
                  >
                    Place Bid
                  </button>
                )}
                {showSettlementFlow && (
                  <button
                    onClick={handleSettlementClick}
                    disabled={isSettlementButtonDisabled()}
                    className="btn btn-primary font-display uppercase tracking-wide"
                  >
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {getSettlementButtonText()}
                  </button>
                )}
                {canClaimRefund && (
                  <button
                    onClick={handleClaimRefund}
                    disabled={isLoading}
                    className="btn btn-secondary font-display uppercase tracking-wide"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Claim Refund
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={handleCancelAuction}
                    disabled={isLoading}
                    className="btn btn-error font-display uppercase tracking-wide"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Cancel Auction
                  </button>
                )}
              </>
            )}
            <button onClick={onClose} className="btn btn-ghost font-display uppercase tracking-wide">
              Close
            </button>
          </div>
        </div>
        <div className="modal-backdrop bg-black/50" onClick={onClose} />
      </div>

      {/* Place Bid Modal */}
      {showBidModal && (
        <PlaceBidModal
          auction={auction}
          isOpen={showBidModal}
          onClose={() => {
            setShowBidModal(false);
            onClose();
          }}
        />
      )}
    </>
  );
};
