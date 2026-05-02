"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { Coins, Loader2, RefreshCw, Lock, Unlock } from "lucide-react";
import toast from "react-hot-toast";
import { FheTypes } from "@cofhe/sdk";
import { betTokenAbi } from "@/utils/marketContracts";
import { toastTxSuccess } from "@/utils/explorerLink";
import { usePermit } from "@/hooks/usePermit";
import { cofheClient } from "@/services/cofhe-client";
import { useCofhe } from "@/hooks/useCofhe";

const TOKEN_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS as `0x${string}`;
const MINT_AMOUNT = BigInt(1000 * 1_000_000);

export const MintPage = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { isInitialized: isCofheReady } = useCofhe();
  const { hasValidPermit, generatePermit, isGeneratingPermit } = usePermit();

  const [unsealedBalance, setUnsealedBalance] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isUnsealing, setIsUnsealing] = useState(false);

  const isWalletConnected = !!address;

  const refreshBalance = useCallback(async () => {
    if (!publicClient || !address) return;
    setIsRefreshing(true);
    try {
      const balance = await publicClient.readContract({
        address: TOKEN_CONTRACT_ADDRESS,
        abi: betTokenAbi,
        functionName: "balanceOf",
        args: [address],
        blockTag: "latest",
      });
    } catch (error) {
      console.error("Failed to get balance:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [publicClient, address]);



  const handleMint = async () => {
    if (!walletClient || !address || !publicClient) {
      toast.error("Wallet not connected");
      return;
    }
    setIsMinting(true);
    try {
      toast.loading("Minting 1,000 AUCT tokens...", { id: "mint-tokens" });
      const hash = await walletClient.writeContract({
        address: TOKEN_CONTRACT_ADDRESS,
        abi: betTokenAbi,
        functionName: "mint",
        args: [address, MINT_AMOUNT],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      toastTxSuccess("1,000 AUCT minted!", hash, "mint-tokens");
      setUnsealedBalance(null);
      setUnsealedBalance(null); // Reset unsealed since it changed
      setTimeout(() => handleUnsealBalance(), 500);
    } catch (error) {
      console.error("Failed to mint:", error);
      toast.error("Failed to mint tokens", { id: "mint-tokens" });
    } finally {
      setIsMinting(false);
    }
  };

  const handleUnsealBalance = async () => {
    if (!publicClient || !address || !isCofheReady) {
      toast.error("CoFHE not ready");
      return;
    }

    setIsUnsealing(true);
    try {
      // Ensure we have a permit
      if (!hasValidPermit) {
        toast.loading("Generating decryption permit...", { id: "unseal" });
        const result = await generatePermit();
        if (!result.success) {
          toast.error("Failed to generate permit", { id: "unseal" });
          setIsUnsealing(false);
          return;
        }
        toast.dismiss("unseal");
      }

      toast.loading("Unsealing your encrypted balance...", { id: "unseal" });

      // Get the encrypted balance ciphertext hash
      const ctHash = await publicClient.readContract({
        address: TOKEN_CONTRACT_ADDRESS,
        abi: betTokenAbi,
        functionName: "confidentialBalanceOf",
        args: [address],
      });

      if (!ctHash || ctHash === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        setUnsealedBalance("0");
        toast.success("Balance unsealed!", { id: "unseal" });
        setIsUnsealing(false);
        return;
      }

      // Decrypt using the permit (view-only, no on-chain tx)
      const result = await cofheClient.decryptForView(ctHash as `0x${string}`, FheTypes.Uint64).execute();
      const decryptedValue = typeof result === "bigint" ? result : (result as any).decryptedValue ?? result;
      const formatted = (Number(decryptedValue) / 1_000_000).toLocaleString();
      setUnsealedBalance(formatted);

      toast.success("Balance unsealed!", { id: "unseal" });
    } catch (error) {
      console.error("Failed to unseal balance:", error);
      toast.error("Failed to unseal balance", { id: "unseal" });
    } finally {
      setIsUnsealing(false);
    }
  };



  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {!isWalletConnected && (
        <div className="alert alert-warning">
          <span className="font-display uppercase tracking-wide text-sm">
            Connect your wallet to mint test tokens
          </span>
        </div>
      )}

      {/* Encrypted Balance */}
      {isWalletConnected && (
        <div className="bg-base-200 border border-base-300 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 border border-primary/30">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-display font-bold text-base-content uppercase tracking-wide">
                Confidential Balance
              </h2>
            </div>
            <button onClick={refreshBalance} disabled={isRefreshing} className="btn btn-ghost btn-sm">
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Show unsealed balance or locked state */}
          {unsealedBalance !== null ? (
            <div>
              <p className="text-4xl font-mono text-primary font-bold mb-1">
                {unsealedBalance} <span className="text-lg text-base-content/50">AUCT</span>
              </p>
              <p className="text-xs text-success flex items-center gap-1.5 mt-1">
                <Unlock className="w-3 h-3" /> Unsealed with your permit — only you can see this
              </p>
            </div>
          ) : (
            <div>
              <p className="text-4xl font-mono text-base-content/30 font-bold mb-1 flex items-center gap-3">
                <Lock className="w-8 h-8" /> ••••••
              </p>
              <p className="text-sm text-base-content/50 mt-2">
                Your balance is encrypted on-chain via FHE
              </p>
            </div>
          )}

          {/* Permit status */}
          {hasValidPermit && (
            <div className="flex items-center gap-1.5 mt-3">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
              <span className="text-xs text-success font-mono">Decryption permit active</span>
            </div>
          )}

          {/* Unseal button */}
          <button
            onClick={handleUnsealBalance}
            disabled={isUnsealing || !isCofheReady}
            className="btn btn-sm btn-ghost border border-primary/30 text-primary mt-4 font-display uppercase tracking-wide"
          >
            {isUnsealing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
            {unsealedBalance !== null ? "Refresh Balance" : "Unseal My Balance"}
          </button>
        </div>
      )}

      {/* Mint Button */}
      {isWalletConnected && (
        <button
          onClick={handleMint}
          disabled={isMinting}
          className="btn btn-fhenix btn-lg w-full font-display uppercase tracking-wide"
        >
          {isMinting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Coins className="w-5 h-5" />
          )}
          Mint 1,000 AUCT Tokens
        </button>
      )}

      {/* Info */}
      <div className="bg-base-200 border border-base-300 p-6">
        <h3 className="text-sm font-display font-bold text-base-content uppercase tracking-wide mb-3">
          How FHE Balances Work
        </h3>
        <div className="space-y-2 text-sm text-base-content/70">
          <p>
            <span className="text-primary font-bold">Encrypted by default:</span> Your AUCT token balance is stored as encrypted data on-chain using Fully Homomorphic Encryption. No one can see it — not even block explorers.
          </p>
          <p>
            <span className="text-primary font-bold">Only you can unseal:</span> Click "Unseal My Balance" to decrypt your balance using your wallet's permit. This happens client-side — the blockchain never sees your plaintext balance.
          </p>
          <p>
            <span className="text-primary font-bold">Bets are confidential:</span> When you place a bet, encrypted tokens are transferred without revealing the amount. The pool totals are computed homomorphically on-chain.
          </p>
        </div>
      </div>
    </div>
  );
};