"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount } from "wagmi";
import { Plus, Clock, Loader2, Check, ChevronRight, PartyPopper, Eye, List, Tag } from "lucide-react";
import toast from "react-hot-toast";
import { useAuction } from "@/hooks/useAuction";
import { useAuctionStore } from "@/services/store/auctionStore";
import { NFTSelector } from "./NFTSelector";

// Duration options in seconds
const DURATION_OPTIONS = [
  { label: "5 minutes", value: 5 * 60 },
  { label: "10 minutes", value: 10 * 60 },
  { label: "1 hour", value: 60 * 60 },
  { label: "1 day", value: 24 * 60 * 60 },
];

/**
 * Form component for creating new auctions
 * 2-step process: 1) Approve NFT, 2) Create Auction
 */
export const CreateAuctionForm = () => {
  const { address } = useAccount();
  const { createAuction, approveNft, isNftApproved, nftContractAddress, tokenContractAddress, isLoading } = useAuction();
  const { setAuctionSubTab, setSelectedAuctionId } = useAuctionStore();

  // Form state
  const [auctionName, setAuctionName] = useState<string>("");
  const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(DURATION_OPTIONS[0].value);

  // Approval state
  const [isApproved, setIsApproved] = useState(false);
  const [isCheckingApproval, setIsCheckingApproval] = useState(false);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdAuctionId, setCreatedAuctionId] = useState<bigint | null>(null);

  const isWalletConnected = !!address;

  // Check approval status when NFT is selected
  useEffect(() => {
    const checkApproval = async () => {
      if (selectedTokenId === null || !nftContractAddress) {
        setIsApproved(false);
        return;
      }

      setIsCheckingApproval(true);
      const approved = await isNftApproved(nftContractAddress as `0x${string}`, selectedTokenId);
      setIsApproved(approved);
      setIsCheckingApproval(false);
    };

    checkApproval();
  }, [selectedTokenId, nftContractAddress, isNftApproved]);

  /**
   * Reset all form fields to initial values
   */
  const resetForm = useCallback(() => {
    setAuctionName("");
    setSelectedTokenId(null);
    setSelectedDuration(DURATION_OPTIONS[0].value);
    setIsApproved(false);
  }, []);

  /**
   * Handle NFT approval (Step 1)
   */
  const handleApprove = async () => {
    if (!isWalletConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (selectedTokenId === null) {
      toast.error("Please select an NFT");
      return;
    }

    if (!nftContractAddress) {
      toast.error("NFT contract not configured");
      return;
    }

    const success = await approveNft(nftContractAddress as `0x${string}`, selectedTokenId);
    if (success) {
      setIsApproved(true);
    }
  };

  /**
   * Validate form inputs before submission
   */
  const validateForm = (): boolean => {
    // Check auction name is provided and valid
    if (!auctionName.trim()) {
      toast.error("Please enter an auction name");
      return false;
    }

    if (auctionName.trim().length > 32) {
      toast.error("Auction name must be 32 characters or less");
      return false;
    }

    // Check NFT is selected
    if (selectedTokenId === null) {
      toast.error("Please select an NFT");
      return false;
    }

    // Check NFT contract is configured
    if (!nftContractAddress) {
      toast.error("NFT contract not configured. Please check environment variables.");
      return false;
    }

    // Check token contract is configured
    if (!tokenContractAddress) {
      toast.error("Payment token not configured. Please check environment variables.");
      return false;
    }

    return true;
  };

  /**
   * Handle auction creation (Step 2)
   */
  const handleCreateAuction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isWalletConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!validateForm()) {
      return;
    }

    if (!isApproved) {
      toast.error("Please approve the NFT first");
      return;
    }

    // Start time is now + 30 seconds buffer (to account for tx mining time)
    // End time is start time + duration
    const now = Math.floor(Date.now() / 1000);
    const startTimestamp = BigInt(now + 30); // 30 second buffer for tx to be mined
    const endTimestamp = BigInt(now + 30 + selectedDuration);

    // Use the fixed addresses from environment
    // Name is now stored on-chain
    const result = await createAuction(
      auctionName.trim(),
      nftContractAddress as `0x${string}`,
      selectedTokenId!,
      tokenContractAddress as `0x${string}`,
      startTimestamp,
      endTimestamp
    );

    if (result !== null) {
      setCreatedAuctionId(result);
      setShowSuccessModal(true);
      resetForm();
    }
  };

  /**
   * Navigate to the created auction
   */
  const handleViewAuction = () => {
    if (createdAuctionId !== null) {
      setSelectedAuctionId(createdAuctionId);
      setShowSuccessModal(false);
    }
  };

  /**
   * Navigate to My Auctions tab
   */
  const handleGoToMyAuctions = () => {
    setAuctionSubTab("my-auctions");
    setShowSuccessModal(false);
  };

  // Get selected duration label for display
  const selectedDurationLabel = DURATION_OPTIONS.find(d => d.value === selectedDuration)?.label || "";

  return (
    <div className="bg-base-200 border border-base-300 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 border border-primary/30">
          <Plus className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-lg font-display font-bold text-base-content uppercase tracking-wide">
          Create New Auction
        </h2>
      </div>

      {/* Wallet not connected warning */}
      {!isWalletConnected && (
        <div className="alert alert-warning mb-6">
          <span className="font-display uppercase tracking-wide text-sm">
            Please connect your wallet to create an auction
          </span>
        </div>
      )}

      <form onSubmit={handleCreateAuction} className="space-y-4">
        {/* Auction Name */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-pixel uppercase tracking-widest text-xs flex items-center gap-2">
              <Tag className="w-3 h-3" />
              Auction Name
            </span>
            <span className="label-text-alt text-base-content/50">
              {auctionName.length}/32 characters
            </span>
          </label>
          <input
            type="text"
            name="auctionName"
            placeholder="e.g., Rare Digital Art #42"
            value={auctionName}
            onChange={(e) => setAuctionName(e.target.value)}
            disabled={!isWalletConnected || isLoading}
            maxLength={32}
            autoComplete="off"
            required
            className={`input input-bordered font-mono text-sm ${
              auctionName.length > 32 ? "input-error" : ""
            }`}
          />
        </div>

        {/* NFT Selector */}
        <NFTSelector
          selectedTokenId={selectedTokenId}
          onSelect={(tokenId) => {
            setSelectedTokenId(tokenId);
            setIsApproved(false); // Reset approval when NFT changes
          }}
          disabled={!isWalletConnected || isLoading}
        />

        {/* Duration Selector */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-pixel uppercase tracking-widest text-xs flex items-center gap-2">
              <Clock className="w-3 h-3" />
              Auction Duration
            </span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {DURATION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedDuration(option.value)}
                disabled={!isWalletConnected || isLoading}
                className={`btn btn-sm font-display uppercase tracking-wide ${
                  selectedDuration === option.value
                    ? "btn-primary"
                    : "btn-outline"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="label">
            <span className="label-text-alt text-base-content/50">
              Auction starts immediately and ends in {selectedDurationLabel}
            </span>
          </label>
        </div>

        {/* 2-Step Buttons */}
        <div className="pt-4 space-y-3">
          {/* Step 1: Approve NFT */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 font-bold text-sm ${
              isApproved
                ? "bg-success text-success-content border-success"
                : "border-primary text-primary"
            }`}>
              {isApproved ? <Check className="w-4 h-4" /> : "1"}
            </div>
            <button
              type="button"
              onClick={handleApprove}
              disabled={!isWalletConnected || isLoading || selectedTokenId === null || isApproved || isCheckingApproval}
              className={`btn flex-1 font-display uppercase tracking-wide ${
                isApproved ? "btn-success btn-outline" : "btn-primary"
              }`}
            >
              {isCheckingApproval ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking...
                </>
              ) : isLoading && !isApproved ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Approving...
                </>
              ) : isApproved ? (
                <>
                  <Check className="w-4 h-4" />
                  NFT Approved
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4" />
                  Approve NFT
                </>
              )}
            </button>
          </div>

          {/* Step 2: Create Auction */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 font-bold text-sm ${
              isApproved
                ? "border-primary text-primary"
                : "border-base-300 text-base-content/30"
            }`}>
              2
            </div>
            <button
              type="submit"
              disabled={!isWalletConnected || isLoading || !isApproved}
              className="btn btn-primary flex-1 font-display uppercase tracking-wide"
            >
              {isLoading && isApproved ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Auction...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Auction
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-base-100 border border-base-300 p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-success/10 border border-success/30 rounded-full mb-4">
                <PartyPopper className="w-8 h-8 text-success" />
              </div>
              <h3 className="text-xl font-display font-bold text-base-content uppercase tracking-wide mb-2">
                Auction Created!
              </h3>
              <p className="text-base-content/70 mb-6">
                Your auction #{createdAuctionId?.toString()} has been created successfully and is now active.
              </p>
              <div className="flex flex-col w-full gap-3">
                <button
                  onClick={handleViewAuction}
                  className="btn btn-primary w-full font-display uppercase tracking-wide gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View Auction
                </button>
                <button
                  onClick={handleGoToMyAuctions}
                  className="btn btn-outline w-full font-display uppercase tracking-wide gap-2"
                >
                  <List className="w-4 h-4" />
                  Go to My Auctions
                </button>
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="btn btn-ghost btn-sm w-full font-display uppercase tracking-wide"
                >
                  Create Another Auction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
