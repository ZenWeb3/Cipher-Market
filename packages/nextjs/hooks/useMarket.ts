"use client";

import { useState, useCallback } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseEventLogs } from "viem";
import { Encryptable } from "@cofhe/sdk";
import { cofheClient } from "@/services/cofhe-client";
import toast from "react-hot-toast";
import { useMarketStore } from "@/services/store/marketStore";
import { toastTxSuccess } from "@/utils/explorerLink";
import {
  MarketData,
  MarketStatus,
  Outcome,
  cipherMarketAbi,
  betTokenAbi,
} from "@/utils/marketContracts";

const MARKET_CONTRACT_ADDRESS = process.env
  .NEXT_PUBLIC_MARKET_CONTRACT_ADDRESS as `0x${string}`;
const TOKEN_CONTRACT_ADDRESS = process.env
  .NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS as `0x${string}`;

// FHE operations are gas-heavy, so we set explicit gas limits
const FHE_GAS_LIMIT = 10_000_000n;

export function useMarket() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const { setCachedMarket, triggerRefresh } = useMarketStore();

  const [isLoading, setIsLoading] = useState(false);

  // ============ Read Functions ============

  const getMarket = useCallback(
    async (marketId: bigint): Promise<MarketData | null> => {
      if (!publicClient) return null;
      try {
        const result = await publicClient.readContract({
          address: MARKET_CONTRACT_ADDRESS,
          abi: cipherMarketAbi,
          functionName: "getMarket",
          args: [marketId],
        });

        const view = result as any;
        const marketData: MarketData = {
          id: marketId,
          question: view.question,
          creator: view.creator,
          fherc20Token: view.fherc20Token,
          startTime: view.startTime,
          endTime: view.endTime,
          status: view.status as MarketStatus,
          winningOutcome: view.winningOutcome as Outcome,
          decryptedYesPool: view.decryptedYesPool,
          decryptedNoPool: view.decryptedNoPool,
          totalBets: view.totalBets,
          yesBettors: view.yesBettors,
          noBettors: view.noBettors,
        };

        setCachedMarket(marketId, marketData);
        return marketData;
      } catch (error) {
        console.error("Failed to get market:", error);
        return null;
      }
    },
    [publicClient, setCachedMarket],
  );

  const getTotalMarkets = useCallback(async (): Promise<bigint> => {
    if (!publicClient) return BigInt(0);
    try {
      const result = await publicClient.readContract({
        address: MARKET_CONTRACT_ADDRESS,
        abi: cipherMarketAbi,
        functionName: "nextMarketId",
      });
      return result as bigint;
    } catch (error) {
      console.error("Failed to get total markets:", error);
      return BigInt(0);
    }
  }, [publicClient]);

  const getAllMarkets = useCallback(
    async (startId: bigint, limit: number): Promise<MarketData[]> => {
      if (!publicClient) return [];
      try {
        const total = await getTotalMarkets();
        const endId =
          startId + BigInt(limit) > total ? total : startId + BigInt(limit);
        const ids: bigint[] = [];
        for (let i = startId; i < endId; i++) ids.push(i);
        const results = await Promise.all(ids.map((id) => getMarket(id)));
        return results.filter((m): m is MarketData => m !== null);
      } catch (error) {
        console.error("Failed to get all markets:", error);
        return [];
      }
    },
    [publicClient, getTotalMarkets, getMarket],
  );

  const hasBetOnMarket = useCallback(
    async (marketId: bigint, bettor: string): Promise<boolean> => {
      if (!publicClient) return false;
      try {
        const result = await publicClient.readContract({
          address: MARKET_CONTRACT_ADDRESS,
          abi: cipherMarketAbi,
          functionName: "hasBetOnMarket",
          args: [marketId, bettor as `0x${string}`],
        });
        return result as boolean;
      } catch {
        return false;
      }
    },
    [publicClient],
  );

  const getBettorOutcome = useCallback(
    async (marketId: bigint, bettor: string): Promise<Outcome | null> => {
      if (!publicClient) return null;
      try {
        const result = await publicClient.readContract({
          address: MARKET_CONTRACT_ADDRESS,
          abi: cipherMarketAbi,
          functionName: "getBettorOutcome",
          args: [marketId, bettor as `0x${string}`],
        });
        return result as Outcome;
      } catch {
        return null;
      }
    },
    [publicClient],
  );

  const hasClaimedFromMarket = useCallback(
    async (marketId: bigint, bettor: string): Promise<boolean> => {
      if (!publicClient) return false;
      try {
        const result = await publicClient.readContract({
          address: MARKET_CONTRACT_ADDRESS,
          abi: cipherMarketAbi,
          functionName: "hasClaimedFromMarket",
          args: [marketId, bettor as `0x${string}`],
        });
        return result as boolean;
      } catch {
        return false;
      }
    },
    [publicClient],
  );

  // ============ Write Functions ============

  const createMarket = useCallback(
    async (
      question: string,
      startTime: bigint,
      endTime: bigint,
    ): Promise<bigint | null> => {
      if (!walletClient || !address || !publicClient) {
        toast.error("Wallet not connected");
        return null;
      }
      setIsLoading(true);
      try {
        toast.loading("Creating market...", { id: "create-market" });
        const hash = await walletClient.writeContract({
          address: MARKET_CONTRACT_ADDRESS,
          abi: cipherMarketAbi,
          functionName: "createMarket",
          args: [question, TOKEN_CONTRACT_ADDRESS, startTime, endTime],
          gas: FHE_GAS_LIMIT,
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") {
          toast.error("Market creation failed", { id: "create-market" });
          return null;
        }
        const events = parseEventLogs({
          abi: cipherMarketAbi,
          logs: receipt.logs,
        });
        const event = events.find((e) => e.eventName === "MarketCreated");
        const marketId = (event?.args as any)?.marketId ?? null;
        toastTxSuccess("Market created!", hash, "create-market");
        triggerRefresh();
        return marketId;
      } catch (error: any) {
        console.error("Failed to create market:", error);
        console.error("Error details:", error?.cause || error?.message);
        toast.error("Failed to create market", { id: "create-market" });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, address, publicClient, triggerRefresh],
  );

  const placeBet = useCallback(
    async (
      marketId: bigint,
      outcome: Outcome,
      amount: bigint,
    ): Promise<string | null> => {
      if (!walletClient || !address || !publicClient) {
        toast.error("Wallet not connected");
        return null;
      }
      setIsLoading(true);
      try {
        // Check if already bet
        const alreadyBet = await hasBetOnMarket(marketId, address);
        if (alreadyBet) {
          toast.error("You have already placed a bet on this market");
          setIsLoading(false);
          return null;
        }

        // Check operator approval
        toast.loading("Checking approval...", { id: "check-operator" });
        const isApproved = await publicClient.readContract({
          address: TOKEN_CONTRACT_ADDRESS,
          abi: betTokenAbi,
          functionName: "isOperator",
          args: [address, MARKET_CONTRACT_ADDRESS],
        });
        toast.dismiss("check-operator");

        if (!isApproved) {
          toast.loading("Setting operator approval...", { id: "set-operator" });
          const until = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
          const opHash = await walletClient.writeContract({
            address: TOKEN_CONTRACT_ADDRESS,
            abi: betTokenAbi,
            functionName: "setOperator",
            args: [MARKET_CONTRACT_ADDRESS, until],
          });
          await publicClient.waitForTransactionReceipt({ hash: opHash });
          toastTxSuccess("Approval set!", opHash, "set-operator");
        }

        // Encrypt bet
        toast.loading("Encrypting your bet...", { id: "encrypt-bet" });
        const [encrypted] = await cofheClient
          .encryptInputs([Encryptable.uint64(amount)])
          .execute();

        if (!encrypted) {
          toast.error("Failed to encrypt bet", { id: "encrypt-bet" });
          return null;
        }

        const encryptedAmount = {
          ctHash: encrypted.ctHash,
          securityZone: encrypted.securityZone,
          utype: encrypted.utype,
          signature: encrypted.signature as `0x${string}`,
        };
        toast.loading("Submitting encrypted bet to chain...", {
          id: "encrypt-bet",
        });

        // Place bet with high gas limit for FHE operations
        const hash = await walletClient.writeContract({
          address: MARKET_CONTRACT_ADDRESS,
          abi: cipherMarketAbi,
          functionName: "placeBet",
          args: [marketId, outcome, encryptedAmount],
          gas: FHE_GAS_LIMIT,
        });

        toast.loading("Waiting for confirmation...", { id: "encrypt-bet" });
        await publicClient.waitForTransactionReceipt({ hash });
        toastTxSuccess("Bet placed successfully!", hash, "encrypt-bet");
        triggerRefresh();
        return hash;
      } catch (error) {
        console.error("Failed to place bet:", error);
        toast.error("Failed to place bet", { id: "place-bet" });
        toast.dismiss("check-operator");
        toast.dismiss("set-operator");
        toast.dismiss("encrypt-bet");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, address, publicClient, hasBetOnMarket, triggerRefresh],
  );

  const resolveMarket = useCallback(
    async (marketId: bigint, winningOutcome: Outcome): Promise<boolean> => {
      if (!walletClient || !address || !publicClient) {
        toast.error("Wallet not connected");
        return false;
      }
      setIsLoading(true);
      try {
        toast.loading("Resolving market...", { id: "resolve-market" });
        const hash = await walletClient.writeContract({
          address: MARKET_CONTRACT_ADDRESS,
          abi: cipherMarketAbi,
          functionName: "resolveMarket",
          args: [marketId, winningOutcome],
          gas: FHE_GAS_LIMIT,
        });

        toast.loading("Waiting for confirmation...", { id: "resolve-market" });
        await publicClient.waitForTransactionReceipt({ hash });
        toastTxSuccess("Market resolved!", hash, "resolve-market");
        triggerRefresh();
        return true;
      } catch (error) {
        console.error("Failed to resolve market:", error);
        toast.error("Failed to resolve market", { id: "resolve-market" });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, address, publicClient, triggerRefresh],
  );

  const finalizeSettlement = useCallback(
    async (marketId: bigint): Promise<boolean> => {
      if (!walletClient || !address || !publicClient) {
        toast.error("Wallet not connected");
        return false;
      }
      setIsLoading(true);
      try {
        toast.loading("Fetching encrypted pool data...", { id: "finalize" });
        const ctHashes = (await publicClient.readContract({
          address: MARKET_CONTRACT_ADDRESS,
          abi: cipherMarketAbi,
          functionName: "getSettlementCtHashes",
          args: [marketId],
        })) as [`0x${string}`, `0x${string}`];

        toast.loading("Decrypting pool totals via Threshold Network...", {
          id: "finalize",
        });
        const [yesResult, noResult] = await Promise.all([
          cofheClient.decryptForTx(ctHashes[0]).withoutPermit().execute(),
          cofheClient.decryptForTx(ctHashes[1]).withoutPermit().execute(),
        ]);

        toast.loading("Finalizing settlement on-chain...", { id: "finalize" });
        const hash = await walletClient.writeContract({
          address: MARKET_CONTRACT_ADDRESS,
          abi: cipherMarketAbi,
          functionName: "finalizeSettlement",
          args: [
            marketId,
            yesResult.decryptedValue,
            noResult.decryptedValue,
            yesResult.signature,
            noResult.signature,
          ],
          gas: FHE_GAS_LIMIT,
        });

        toast.loading("Waiting for confirmation...", { id: "finalize" });
        await publicClient.waitForTransactionReceipt({ hash });
        toastTxSuccess("Settlement finalized!", hash, "finalize");
        triggerRefresh();
        return true;
      } catch (error) {
        console.error("Failed to finalize:", error);
        toast.error("Failed to finalize settlement", { id: "finalize" });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, address, publicClient, triggerRefresh],
  );

  const claimWinnings = useCallback(
    async (marketId: bigint): Promise<boolean> => {
      if (!walletClient || !address || !publicClient) {
        toast.error("Wallet not connected");
        return false;
      }
      setIsLoading(true);
      try {
        // Request bet decryption on-chain
        toast.loading("Requesting bet decryption...", { id: "claim-win" });
        const reqHash = await walletClient.writeContract({
          address: MARKET_CONTRACT_ADDRESS,
          abi: cipherMarketAbi,
          functionName: "requestBetDecryption",
          args: [marketId],
          gas: FHE_GAS_LIMIT,
        });

        toast.loading("Waiting for decryption request...", { id: "claim-win" });
        const reqReceipt = await publicClient.waitForTransactionReceipt({
          hash: reqHash,
        });
        console.log("requestBetDecryption receipt:", reqReceipt.status);

        await new Promise((r) => setTimeout(r, 5000));
        // Get encrypted deposit and decrypt it
        toast.loading("Decrypting your bet amount...", { id: "claim-win" });
        const depositCt = await publicClient.readContract({
          address: MARKET_CONTRACT_ADDRESS,
          abi: cipherMarketAbi,
          functionName: "getBettorDeposit",
          args: [marketId, address],
        });

        const decryptResult = await cofheClient
          .decryptForTx(depositCt as `0x${string}`)
          .withoutPermit()
          .execute();

        // Claim winnings with proof
        toast.loading("Claiming winnings on-chain...", { id: "claim-win" });
        const hash = await walletClient.writeContract({
          address: MARKET_CONTRACT_ADDRESS,
          abi: cipherMarketAbi,
          functionName: "claimWinnings",
          args: [
            marketId,
            decryptResult.decryptedValue,
            decryptResult.signature,
          ],
          gas: FHE_GAS_LIMIT,
        });

        toast.loading("Waiting for confirmation...", { id: "claim-win" });
        await publicClient.waitForTransactionReceipt({ hash });
        toastTxSuccess("Winnings claimed!", hash, "claim-win");
        triggerRefresh();
        return true;
      } catch (error) {
        console.error("Failed to claim winnings:", error);
        toast.error("Failed to claim winnings", { id: "claim-win" });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, address, publicClient, triggerRefresh],
  );

  const claimRefund = useCallback(
    async (marketId: bigint): Promise<boolean> => {
      if (!walletClient || !address || !publicClient) {
        toast.error("Wallet not connected");
        return false;
      }
      setIsLoading(true);
      try {
        toast.loading("Claiming refund...", { id: "claim-refund" });
        const hash = await walletClient.writeContract({
          address: MARKET_CONTRACT_ADDRESS,
          abi: cipherMarketAbi,
          functionName: "claimRefund",
          args: [marketId],
          gas: FHE_GAS_LIMIT,
        });

        toast.loading("Waiting for confirmation...", { id: "claim-refund" });
        await publicClient.waitForTransactionReceipt({ hash });
        toastTxSuccess("Refund claimed!", hash, "claim-refund");
        triggerRefresh();
        return true;
      } catch (error) {
        console.error("Failed to claim refund:", error);
        toast.error("Failed to claim refund", { id: "claim-refund" });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, address, publicClient, triggerRefresh],
  );

  const cancelMarket = useCallback(
    async (marketId: bigint): Promise<boolean> => {
      if (!walletClient || !address || !publicClient) {
        toast.error("Wallet not connected");
        return false;
      }
      setIsLoading(true);
      try {
        toast.loading("Cancelling market...", { id: "cancel-market" });
        const hash = await walletClient.writeContract({
          address: MARKET_CONTRACT_ADDRESS,
          abi: cipherMarketAbi,
          functionName: "cancelMarket",
          args: [marketId],
        });

        toast.loading("Waiting for confirmation...", { id: "cancel-market" });
        await publicClient.waitForTransactionReceipt({ hash });
        toastTxSuccess("Market cancelled!", hash, "cancel-market");
        triggerRefresh();
        return true;
      } catch (error) {
        console.error("Failed to cancel market:", error);
        toast.error("Failed to cancel market", { id: "cancel-market" });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, address, publicClient, triggerRefresh],
  );

  return {
    isLoading,
    marketContractAddress: MARKET_CONTRACT_ADDRESS,
    tokenContractAddress: TOKEN_CONTRACT_ADDRESS,
    getMarket,
    getTotalMarkets,
    getAllMarkets,
    hasBetOnMarket,
    getBettorOutcome,
    hasClaimedFromMarket,
    createMarket,
    placeBet,
    resolveMarket,
    finalizeSettlement,
    claimWinnings,
    claimRefund,
    cancelMarket,
  };
}
