"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { Coins, ImageIcon, Loader2, RefreshCw, Lock, Unlock, Key, ArrowRight } from "lucide-react";
import { useAuctionStore } from "@/services/store/auctionStore";
import { useMint } from "@/hooks/useMint";
import { useCofhe } from "@/hooks/useCofhe";
import { usePermit } from "@/hooks/usePermit";
import { PermitModal } from "@/components/PermitModal";

export const MintPage = () => {
  const { address } = useAccount();
  const { setMainTab } = useAuctionStore();
  const {
    isLoading,
    getNftBalance,
    getEncryptedTokenBalanceHash,
    unsealTokenBalance,
    mintNft,
    mintTokens,
  } = useMint();
  const { isInitialized: isCofheInitialized, isInitializing: isCofheInitializing } = useCofhe();
  const { hasValidPermit, isGeneratingPermit, generatePermit } = usePermit();

  const ZERO_HASH = `0x${"0".repeat(64)}` as `0x${string}`;
  const [nftBalance, setNftBalance] = useState<bigint>(BigInt(0));
  const [encryptedTokenBalance, setEncryptedTokenBalance] = useState<bigint | null>(null);
  const [encryptedBalanceHash, setEncryptedBalanceHash] = useState<`0x${string}`>(ZERO_HASH);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUnsealing, setIsUnsealing] = useState(false);
  const [isPermitModalOpen, setIsPermitModalOpen] = useState(false);

  const isWalletConnected = !!address;

  const refreshBalances = useCallback(async () => {
    setIsRefreshing(true);
    const [nft, encryptedHash] = await Promise.all([
      getNftBalance(),
      getEncryptedTokenBalanceHash(),
    ]);
    setNftBalance(nft);
    setEncryptedBalanceHash(encryptedHash);
    // Reset encrypted balance when refreshing - user needs to unseal again
    setEncryptedTokenBalance(null);
    setIsRefreshing(false);
  }, [getNftBalance, getEncryptedTokenBalanceHash]);

  useEffect(() => {
    if (isWalletConnected) {
      refreshBalances();
    }
  }, [isWalletConnected, refreshBalances]);

  const handleMintNft = async () => {
    const success = await mintNft();
    if (success) {
      refreshBalances();
    }
  };

  const handleMintTokens = async () => {
    const success = await mintTokens();
    if (success) {
      refreshBalances();
    }
  };

  const handleUnsealBalance = async () => {
    if (!hasValidPermit) {
      // Create permit first
      const result = await generatePermit();
      if (!result.success) return;
    }

    setIsUnsealing(true);
    const unsealed = await unsealTokenBalance(encryptedBalanceHash);
    setEncryptedTokenBalance(unsealed);
    setIsUnsealing(false);
  };

  // Format token balance (6 decimals)
  const formattedEncryptedBalance = encryptedTokenBalance !== null
    ? (Number(encryptedTokenBalance) / 1_000_000).toLocaleString()
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-bold text-base-content uppercase tracking-wide">
          Your Balances
        </h2>
        {isWalletConnected && (
          <button
            onClick={refreshBalances}
            disabled={isRefreshing}
            className="btn btn-ghost btn-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {/* Wallet not connected warning */}
      {!isWalletConnected && (
        <div className="alert alert-warning">
          <span className="font-display uppercase tracking-wide text-sm">
            Please connect your wallet to mint test assets
          </span>
        </div>
      )}

      {/* CoFHE Status */}
      {isWalletConnected && (
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${isCofheInitialized ? "bg-green-500" : isCofheInitializing ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`} />
          <span className="text-base-content/70">
            {isCofheInitialized ? "FHE Ready" : isCofheInitializing ? "Initializing FHE..." : "FHE Not Initialized"}
          </span>
          <span className="text-base-content/30">|</span>
          <button
            onClick={() => setIsPermitModalOpen(true)}
            className={`btn btn-xs gap-1 ${hasValidPermit ? "btn-primary" : "btn-outline"}`}
          >
            <Key className="w-3 h-3" />
            {hasValidPermit ? "Permit Active" : "Manage Permit"}
          </button>
        </div>
      )}

      {/* Balances Display */}
      {isWalletConnected && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* NFT Balance Card */}
          <div className="bg-base-200 border border-base-300 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary/10 border border-primary/30">
                <ImageIcon className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-display font-bold text-base-content uppercase tracking-wide">
                NFT Balance
              </h2>
            </div>
            <p className="text-3xl font-mono text-base-content mb-2">
              {nftBalance.toString()}
            </p>
            <p className="text-sm text-base-content/50">Auction NFTs owned</p>
          </div>

          {/* Encrypted Token Balance Card */}
          <div className="bg-base-200 border border-base-300 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-accent/10 border border-accent/30">
                <Lock className="w-5 h-5 text-accent" />
              </div>
              <h2 className="text-lg font-display font-bold text-base-content uppercase tracking-wide">
                Encrypted Balance
              </h2>
            </div>
            {encryptedTokenBalance !== null ? (
              <>
                <p className="text-3xl font-mono text-base-content mb-2">
                  {formattedEncryptedBalance}
                </p>
                <p className="text-sm text-base-content/50">AUCT tokens (shielded)</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-mono text-base-content/30 mb-2">
                  ******
                </p>
                <button
                  onClick={handleUnsealBalance}
                  disabled={!isCofheInitialized || isUnsealing || isGeneratingPermit || /^0x0+$/.test(encryptedBalanceHash)}
                  className="btn btn-sm btn-accent gap-2 font-display uppercase tracking-wide"
                >
                  {isUnsealing || isGeneratingPermit ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                  {!hasValidPermit ? "Create Permit & Unseal" : "Unseal Balance"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mint Buttons */}
      {isWalletConnected && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mint NFT Button */}
          <button
            onClick={handleMintNft}
            disabled={isLoading}
            className="btn btn-primary btn-lg font-display uppercase tracking-wide"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ImageIcon className="w-5 h-5" />
            )}
            Mint 1 NFT
          </button>

          {/* Mint Tokens Button */}
          <button
            onClick={handleMintTokens}
            disabled={isLoading}
            className="btn btn-secondary btn-lg font-display uppercase tracking-wide"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Coins className="w-5 h-5" />
            )}
            Mint 1000 Tokens
          </button>
        </div>
      )}

      {/* Permit Section */}
      {isWalletConnected && isCofheInitialized && !hasValidPermit && (
        <div className="bg-accent/10 border border-accent/30 p-6">
          <div className="flex items-start gap-4">
            <Key className="w-6 h-6 text-accent mt-1" />
            <div className="flex-1">
              <h3 className="text-sm font-display font-bold text-base-content uppercase tracking-wide mb-2">
                Create Permit to View Encrypted Balance
              </h3>
              <p className="text-sm text-base-content/70 mb-4">
                A permit allows you to decrypt and view your encrypted token balance.
                This requires signing a message with your wallet.
              </p>
              <button
                onClick={generatePermit}
                disabled={isGeneratingPermit}
                className="btn btn-accent btn-sm gap-2 font-display uppercase tracking-wide"
              >
                {isGeneratingPermit ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Key className="w-4 h-4" />
                )}
                Create Permit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-base-200 border border-base-300 p-6">
        <h3 className="text-sm font-display font-bold text-base-content uppercase tracking-wide mb-3">
          About Test Assets
        </h3>
        <ul className="text-sm text-base-content/70 space-y-2">
          <li>* <strong>Auction NFTs</strong> can be listed for auction</li>
          <li>* <strong>AUCT tokens</strong> are used to place encrypted bids</li>
          <li>* <strong>Public Balance</strong> is visible to everyone on-chain</li>
          <li>* <strong>Encrypted Balance</strong> is private and requires a permit to view</li>
          <li>* Use <strong>Shield</strong> to convert public tokens to encrypted tokens</li>
          <li>* These are test assets on <strong>Arbitrum Sepolia</strong></li>
        </ul>
      </div>

      {/* Go to Auctions Button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={() => setMainTab("auctions")}
          className="btn btn-primary btn-lg gap-2 font-display uppercase tracking-wide"
        >
          Go to Auctions
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* Permit Modal */}
      <PermitModal
        isOpen={isPermitModalOpen}
        onClose={() => setIsPermitModalOpen(false)}
      />
    </div>
  );
};
