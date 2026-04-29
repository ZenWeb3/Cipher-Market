"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount } from "wagmi";
import { Gavel, Lock, X, Loader2, Wallet, Unlock } from "lucide-react";
import { useAuction } from "@/hooks/useAuction";
import { useMint } from "@/hooks/useMint";
import { useCofhe } from "@/hooks/useCofhe";
import { usePermit } from "@/hooks/usePermit";
import { AuctionData } from "@/utils/auctionContracts";

/**
 * Save bid transaction hash to localStorage
 */
function saveBidTxHash(auctionId: bigint, bidder: string, txHash: string): void {
  if (typeof window === "undefined") return;
  try {
    const bidTxHashes = JSON.parse(localStorage.getItem("bidTxHashes") || "{}");
    const key = `${auctionId.toString()}-${bidder.toLowerCase()}`;
    bidTxHashes[key] = txHash;
    localStorage.setItem("bidTxHashes", JSON.stringify(bidTxHashes));
  } catch {
    console.error("Failed to save bid tx hash to localStorage");
  }
}

interface PlaceBidModalProps {
  auction: AuctionData;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal component for placing encrypted bids on auctions
 * Uses FHE (Fully Homomorphic Encryption) to encrypt bid amounts
 */
export const PlaceBidModal = ({ auction, isOpen, onClose }: PlaceBidModalProps) => {
  const { address } = useAccount();
  const { placeBid, isLoading } = useAuction();
  const { getEncryptedTokenBalanceHash, unsealTokenBalance } = useMint();
  const { isInitialized: isCofheInitialized } = useCofhe();
  const { hasValidPermit, generatePermit, isGeneratingPermit } = usePermit();

  const ZERO_HASH = `0x${"0".repeat(64)}` as `0x${string}`;
  const [bidAmount, setBidAmount] = useState<string>("");
  const [encryptedBalanceHash, setEncryptedBalanceHash] = useState<`0x${string}`>(ZERO_HASH);
  const [unsealedBalance, setUnsealedBalance] = useState<bigint | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isUnsealing, setIsUnsealing] = useState(false);

  // Fetch encrypted balance hash when modal opens
  useEffect(() => {
    const fetchBalance = async () => {
      if (!isOpen) return;
      setIsLoadingBalance(true);
      const hash = await getEncryptedTokenBalanceHash();
      setEncryptedBalanceHash(hash);
      setIsLoadingBalance(false);
    };
    fetchBalance();
  }, [isOpen, getEncryptedTokenBalanceHash]);

  // Handle unsealing balance
  const handleUnsealBalance = async () => {
    if (!hasValidPermit) {
      const result = await generatePermit();
      if (!result.success) return;
    }

    setIsUnsealing(true);
    const unsealed = await unsealTokenBalance(encryptedBalanceHash);
    setUnsealedBalance(unsealed);
    setIsUnsealing(false);
  };

  // Format balance for display (6 decimals)
  const formattedBalance = unsealedBalance !== null
    ? (Number(unsealedBalance) / 1_000_000).toLocaleString()
    : null;

  /**
   * Reset form state and close modal
   */
  const handleClose = useCallback(() => {
    setBidAmount("");
    setUnsealedBalance(null);
    onClose();
  }, [onClose]);

  /**
   * Handle backdrop click to close modal
   */
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  /**
   * Handle bid submission
   * Converts amount to token units (6 decimals) and calls placeBid
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bidAmount || parseFloat(bidAmount) <= 0 || !address) {
      return;
    }

    // Convert to token units (6 decimals)
    const amountInTokenUnits = BigInt(Math.floor(parseFloat(bidAmount) * 1_000_000));

    const txHash = await placeBid(auction.id, amountInTokenUnits);

    if (txHash) {
      // Save the transaction hash for later display
      saveBidTxHash(auction.id, address, txHash);
      handleClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative bg-base-100 border border-base-300 p-6 w-full max-w-md mx-4">
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 text-base-content/50 hover:text-base-content transition-colors"
          disabled={isLoading}
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 border border-primary/30">
            <Gavel className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-lg font-display font-bold text-base-content uppercase tracking-wide">
            Place Bid - Auction #{auction.id.toString()}
          </h2>
        </div>

        {/* Your Balance */}
        <div className="bg-base-200 border border-base-300 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-xs font-pixel text-base-content/70 uppercase tracking-widest">
                Your Balance
              </span>
            </div>
            {isLoadingBalance ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-base-content/50">Loading...</span>
              </div>
            ) : unsealedBalance !== null ? (
              <span className="text-lg font-mono text-base-content">
                {formattedBalance} <span className="text-xs text-base-content/50">AUCT</span>
              </span>
            ) : (
              <button
                onClick={handleUnsealBalance}
                disabled={!isCofheInitialized || isUnsealing || isGeneratingPermit || /^0x0+$/.test(encryptedBalanceHash)}
                className="btn btn-xs btn-accent gap-1"
              >
                {isUnsealing || isGeneratingPermit ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Unlock className="w-3 h-3" />
                )}
                {/^0x0+$/.test(encryptedBalanceHash) ? "No Balance" : "View Balance"}
              </button>
            )}
          </div>
        </div>

        {/* Privacy notice */}
        <div className="bg-base-200 border border-base-300 p-4 mb-6">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-success font-display uppercase tracking-wide mb-1">
                Encrypted Bid
              </p>
              <p className="text-xs text-base-content/70">
                Your bid amount will be encrypted using Fully Homomorphic Encryption (FHE).
                No one can see your bid until the auction is settled, ensuring a fair sealed-bid process.
              </p>
            </div>
          </div>
        </div>

        {/* Bid form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Bid amount input */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-pixel uppercase tracking-widest text-xs">
                Bid Amount (Tokens)
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                name="bidAmount"
                placeholder="0.000000"
                step="0.000001"
                min="0"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                disabled={isLoading}
                autoComplete="off"
                className="input input-bordered font-mono text-sm flex-1"
              />
              {unsealedBalance !== null && unsealedBalance > BigInt(0) && (
                <button
                  type="button"
                  onClick={() => setBidAmount((Number(unsealedBalance) / 1_000_000).toString())}
                  disabled={isLoading}
                  className="btn btn-outline btn-sm"
                >
                  Max
                </button>
              )}
            </div>
            <label className="label">
              <span className="label-text-alt text-base-content/50">
                Enter the amount you want to bid (6 decimal places)
              </span>
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={isLoading || !bidAmount || parseFloat(bidAmount) <= 0}
              className="btn btn-primary w-full font-display uppercase tracking-wide"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Encrypting...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Place Bid
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="btn btn-ghost w-full font-display uppercase tracking-wide"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
