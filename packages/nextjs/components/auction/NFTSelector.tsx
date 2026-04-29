"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { ImageIcon, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { useNFTOwnership } from "@/hooks/useNFTOwnership";
import { useAuctionStore } from "@/services/store/auctionStore";

interface NFTSelectorProps {
  selectedTokenId: bigint | null;
  onSelect: (tokenId: bigint | null) => void;
  disabled?: boolean;
}

export const NFTSelector = ({ selectedTokenId, onSelect, disabled }: NFTSelectorProps) => {
  const { address } = useAccount();
  const { ownedTokenIds, isLoading, fetchOwnedNFTs } = useNFTOwnership();
  const { setMainTab } = useAuctionStore();

  useEffect(() => {
    if (address) {
      fetchOwnedNFTs();
    }
  }, [address, fetchOwnedNFTs]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "") {
      onSelect(null);
    } else {
      onSelect(BigInt(value));
    }
  };

  if (isLoading) {
    return (
      <div className="form-control">
        <label className="label">
          <span className="label-text font-pixel uppercase tracking-widest text-xs flex items-center gap-2">
            <ImageIcon className="w-3 h-3" />
            Select NFT
          </span>
        </label>
        <div className="input input-bordered flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-base-content/50" />
          <span className="ml-2 text-sm text-base-content/50">Loading NFTs...</span>
        </div>
      </div>
    );
  }

  if (ownedTokenIds.length === 0) {
    return (
      <div className="form-control">
        <label className="label">
          <span className="label-text font-pixel uppercase tracking-widest text-xs flex items-center gap-2">
            <ImageIcon className="w-3 h-3" />
            Select NFT
          </span>
        </label>
        <div className="alert alert-warning flex-col items-start gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">
              You don&apos;t own any NFTs. Go to the <strong>Mint</strong> tab to mint some!
            </span>
          </div>
          <button
            onClick={() => setMainTab("mint")}
            className="btn btn-sm btn-primary gap-2 font-display uppercase tracking-wide"
          >
            Go to Mint
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="form-control">
      <label className="label">
        <span className="label-text font-pixel uppercase tracking-widest text-xs flex items-center gap-2">
          <ImageIcon className="w-3 h-3" />
          Select NFT
        </span>
      </label>
      <select
        value={selectedTokenId?.toString() ?? ""}
        onChange={handleChange}
        disabled={disabled}
        className="select select-bordered font-mono text-sm"
      >
        <option value="">Select an NFT...</option>
        {ownedTokenIds.map((tokenId) => (
          <option key={tokenId.toString()} value={tokenId.toString()}>
            NFT #{tokenId.toString()}
          </option>
        ))}
      </select>
    </div>
  );
};
