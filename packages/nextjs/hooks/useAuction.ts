"use client";

import { useState, useCallback } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseEventLogs } from "viem";
import { Encryptable } from "@cofhe/sdk";
import { cofheClient } from "@/services/cofhe-client";
import toast from "react-hot-toast";
import { useAuctionStore } from "@/services/store/auctionStore";
import { toastTxSuccess } from "@/utils/explorerLink";
import {
  AuctionData,
  AuctionStatus,
  SettlementResult,
  sealedBidAuctionAbi,
  auctionNftAbi,
  auctionTokenAbi,
} from "@/utils/auctionContracts";

// Contract addresses from environment variables
const AUCTION_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS as `0x${string}`;
const NFT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS as `0x${string}`;
const TOKEN_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS as `0x${string}`;

export function useAuction() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const { setCachedAuction, triggerRefresh } = useAuctionStore();

  const [isLoading, setIsLoading] = useState(false);

  // ============ Read Functions ============

  /**
   * Get auction details by ID
   */
  const getAuction = useCallback(
    async (auctionId: bigint): Promise<AuctionData | null> => {
      if (!publicClient) {
        console.error("Public client not available");
        return null;
      }

      try {
        const result = await publicClient.readContract({
          address: AUCTION_CONTRACT_ADDRESS,
          abi: sealedBidAuctionAbi,
          functionName: "getAuction",
          args: [auctionId],
        });

        // The contract returns an AuctionView struct
        const auctionView = result as {
          name: string;
          seller: `0x${string}`;
          nftContract: `0x${string}`;
          tokenId: bigint;
          fherc20Token: `0x${string}`;
          startTime: bigint;
          endTime: bigint;
          status: number;
          totalBids: bigint;
        };

        const auctionData: AuctionData = {
          id: auctionId,
          name: auctionView.name,
          seller: auctionView.seller,
          nftContract: auctionView.nftContract,
          tokenId: auctionView.tokenId,
          fherc20Token: auctionView.fherc20Token,
          startTime: auctionView.startTime,
          endTime: auctionView.endTime,
          status: auctionView.status as AuctionStatus,
          totalBids: auctionView.totalBids,
        };

        // Cache the auction data
        setCachedAuction(auctionId, auctionData);

        return auctionData;
      } catch (error) {
        console.error("Failed to get auction:", error);
        return null;
      }
    },
    [publicClient, setCachedAuction]
  );

  /**
   * Get the total number of auctions (nextAuctionId)
   */
  const getTotalAuctions = useCallback(async (): Promise<bigint> => {
    if (!publicClient) {
      console.error("Public client not available");
      return BigInt(0);
    }

    try {
      const result = await publicClient.readContract({
        address: AUCTION_CONTRACT_ADDRESS,
        abi: sealedBidAuctionAbi,
        functionName: "nextAuctionId",
      });

      return result as bigint;
    } catch (error) {
      console.error("Failed to get total auctions:", error);
      return BigInt(0);
    }
  }, [publicClient]);

  /**
   * Get all auctions within a range
   */
  const getAllAuctions = useCallback(
    async (startId: bigint, limit: number): Promise<AuctionData[]> => {
      if (!publicClient) {
        console.error("Public client not available");
        return [];
      }

      try {
        const totalAuctions = await getTotalAuctions();
        const endId = startId + BigInt(limit) > totalAuctions ? totalAuctions : startId + BigInt(limit);

        // Generate array of auction IDs to fetch
        const auctionIds: bigint[] = [];
        for (let i = startId; i < endId; i++) {
          auctionIds.push(i);
        }

        // Fetch all auctions in parallel to eliminate waterfall
        const auctionResults = await Promise.all(
          auctionIds.map(id => getAuction(id))
        );

        // Filter out null results
        return auctionResults.filter((auction): auction is AuctionData => auction !== null);
      } catch (error) {
        console.error("Failed to get all auctions:", error);
        return [];
      }
    },
    [publicClient, getTotalAuctions, getAuction]
  );

  /**
   * Check if an address has bid on an auction
   */
  const hasBidOnAuction = useCallback(
    async (auctionId: bigint, bidder: string): Promise<boolean> => {
      if (!publicClient) {
        console.error("Public client not available");
        return false;
      }

      try {
        const result = await publicClient.readContract({
          address: AUCTION_CONTRACT_ADDRESS,
          abi: sealedBidAuctionAbi,
          functionName: "hasBidOnAuction",
          args: [auctionId, bidder as `0x${string}`],
        });

        return result as boolean;
      } catch (error) {
        console.error("Failed to check if bid exists:", error);
        return false;
      }
    },
    [publicClient]
  );

  /**
   * Check if an address has claimed their refund
   */
  const hasClaimedRefund = useCallback(
    async (auctionId: bigint, bidder: string): Promise<boolean> => {
      if (!publicClient) {
        console.error("Public client not available");
        return false;
      }

      try {
        const result = await publicClient.readContract({
          address: AUCTION_CONTRACT_ADDRESS,
          abi: sealedBidAuctionAbi,
          functionName: "hasClaimedRefund",
          args: [auctionId, bidder as `0x${string}`],
        });

        return result as boolean;
      } catch (error) {
        console.error("Failed to check refund status:", error);
        return false;
      }
    },
    [publicClient]
  );

  /**
   * Get settlement result for a settled auction
   */
  const getSettlementResult = useCallback(
    async (auctionId: bigint): Promise<SettlementResult | null> => {
      if (!publicClient) {
        console.error("Public client not available");
        return null;
      }

      try {
        const result = await publicClient.readContract({
          address: AUCTION_CONTRACT_ADDRESS,
          abi: sealedBidAuctionAbi,
          functionName: "getSettlementResult",
          args: [auctionId],
        });

        const [winner, amount] = result as [string, bigint];

        return {
          winner: winner as `0x${string}`,
          amount: amount,
        };
      } catch (error) {
        console.error("Failed to get settlement result:", error);
        return null;
      }
    },
    [publicClient]
  );

  // ============ Write Functions ============

  /**
   * Check if NFT is approved for the auction contract
   */
  const isNftApproved = useCallback(
    async (nftContract: `0x${string}`, tokenId: bigint): Promise<boolean> => {
      if (!publicClient) {
        console.error("Public client not available");
        return false;
      }

      try {
        const approved = await publicClient.readContract({
          address: nftContract,
          abi: auctionNftAbi,
          functionName: "getApproved",
          args: [tokenId],
        });

        return (approved as string).toLowerCase() === AUCTION_CONTRACT_ADDRESS.toLowerCase();
      } catch (error) {
        console.error("Failed to check NFT approval:", error);
        return false;
      }
    },
    [publicClient]
  );

  /**
   * Approve NFT for the auction contract
   */
  const approveNft = useCallback(
    async (nftContract: `0x${string}`, tokenId: bigint): Promise<boolean> => {
      if (!walletClient || !address || !publicClient) {
        toast.error("Wallet not connected");
        return false;
      }

      setIsLoading(true);

      try {
        toast.loading("Approving NFT transfer...", { id: "approve-nft" });

        const approveHash = await walletClient.writeContract({
          address: nftContract,
          abi: auctionNftAbi,
          functionName: "approve",
          args: [AUCTION_CONTRACT_ADDRESS, tokenId],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });

        if (receipt.status !== "success") {
          toast.error("NFT approval failed", { id: "approve-nft" });
          return false;
        }

        toastTxSuccess("NFT approved!", approveHash, "approve-nft");
        return true;
      } catch (error) {
        console.error("Failed to approve NFT:", error);
        toast.error("Failed to approve NFT", { id: "approve-nft" });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, address, publicClient]
  );

  /**
   * Create a new auction (NFT must be approved first)
   */
  const createAuction = useCallback(
    async (
      name: string,
      nftContract: `0x${string}`,
      tokenId: bigint,
      fherc20Token: `0x${string}`,
      startTime: bigint,
      endTime: bigint
    ): Promise<bigint | null> => {
      if (!walletClient || !address || !publicClient) {
        toast.error("Wallet not connected");
        return null;
      }

      setIsLoading(true);

      try {
        toast.loading("Creating auction...", { id: "create-auction" });

        const createHash = await walletClient.writeContract({
          address: AUCTION_CONTRACT_ADDRESS,
          abi: sealedBidAuctionAbi,
          functionName: "createAuction",
          args: [name, nftContract, tokenId, fherc20Token, startTime, endTime],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash });

        if (receipt.status !== "success") {
          toast.error("Auction creation failed on chain", { id: "create-auction" });
          return null;
        }

        // Parse the AuctionCreated event using viem's type-safe event parsing
        const events = parseEventLogs({
          abi: sealedBidAuctionAbi,
          logs: receipt.logs,
        });
        const auctionCreatedEvent = events.find((e) => e.eventName === "AuctionCreated");
        const auctionId = auctionCreatedEvent?.args?.auctionId ?? null;

        toastTxSuccess("Auction created successfully!", createHash, "create-auction");
        triggerRefresh();

        return auctionId;
      } catch (error) {
        console.error("Failed to create auction:", error);
        toast.error("Failed to create auction", { id: "create-auction" });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, address, publicClient, triggerRefresh]
  );

  /**
   * Place a bid on an auction
   * Checks if already bid, sets operator approval if needed, encrypts the bid
   * Returns the transaction hash on success, null on failure
   */
  const placeBid = useCallback(
    async (auctionId: bigint, amount: bigint): Promise<string | null> => {
      if (!walletClient || !address || !publicClient) {
        toast.error("Wallet not connected");
        return null;
      }

      setIsLoading(true);

      try {
        // Check if user has already bid on this auction
        const alreadyBid = await hasBidOnAuction(auctionId, address);
        if (alreadyBid) {
          toast.error("You have already placed a bid on this auction");
          return null;
        }

        // Get auction details to get the token address
        const auction = await getAuction(auctionId);
        if (!auction) {
          toast.error("Auction not found");
          return null;
        }

        // Check if operator approval is set for the auction contract
        toast.loading("Checking operator approval...", { id: "check-operator" });

        const isOperatorApproved = await publicClient.readContract({
          address: auction.fherc20Token,
          abi: auctionTokenAbi,
          functionName: "isOperator",
          args: [address, AUCTION_CONTRACT_ADDRESS],
        });

        toast.dismiss("check-operator");

        if (!isOperatorApproved) {
          // Set operator approval (valid for 1 year)
          toast.loading("Setting operator approval...", { id: "set-operator" });

          // Calculate expiration time (1 year from now) - uint48 fits in number
          const until = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

          const setOperatorHash = await walletClient.writeContract({
            address: auction.fherc20Token,
            abi: auctionTokenAbi,
            functionName: "setOperator",
            args: [AUCTION_CONTRACT_ADDRESS, until],
          });

          await publicClient.waitForTransactionReceipt({ hash: setOperatorHash });
          toastTxSuccess("Operator approval set!", setOperatorHash, "set-operator");
        }

        // Encrypt the bid amount using the new @cofhe/sdk builder API
        toast.loading("Encrypting bid...", { id: "encrypt-bid" });

        const [encrypted] = await cofheClient
          .encryptInputs([Encryptable.uint64(amount)])
          .execute();

        if (!encrypted) {
          toast.error("Failed to encrypt bid amount", { id: "encrypt-bid" });
          return null;
        }

        // Format the encrypted value to match the expected ABI structure
        const encryptedAmount = {
          ctHash: encrypted.ctHash,
          securityZone: encrypted.securityZone,
          utype: encrypted.utype,
          signature: encrypted.signature as `0x${string}`,
        };

        toast.success("Bid encrypted!", { id: "encrypt-bid" });

        // Place the bid
        toast.loading("Placing bid...", { id: "place-bid" });

        const bidHash = await walletClient.writeContract({
          address: AUCTION_CONTRACT_ADDRESS,
          abi: sealedBidAuctionAbi,
          functionName: "bid",
          args: [auctionId, encryptedAmount],
        });

        await publicClient.waitForTransactionReceipt({ hash: bidHash });

        toastTxSuccess("Bid placed successfully!", bidHash, "place-bid");
        triggerRefresh();

        return bidHash;
      } catch (error) {
        console.error("Failed to place bid:", error);
        toast.error("Failed to place bid", { id: "place-bid" });
        toast.dismiss("check-operator");
        toast.dismiss("set-operator");
        toast.dismiss("encrypt-bid");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, address, publicClient, hasBidOnAuction, getAuction, triggerRefresh]
  );

  /**
   * Request settlement of an auction (initiates decryption)
   */
  const requestSettlement = useCallback(
    async (auctionId: bigint): Promise<boolean> => {
      if (!walletClient || !address || !publicClient) {
        toast.error("Wallet not connected");
        return false;
      }

      setIsLoading(true);

      try {
        toast.loading("Requesting settlement...", { id: "request-settlement" });

        const hash = await walletClient.writeContract({
          address: AUCTION_CONTRACT_ADDRESS,
          abi: sealedBidAuctionAbi,
          functionName: "requestSettlement",
          args: [auctionId],
        });

        await publicClient.waitForTransactionReceipt({ hash });

        toastTxSuccess("Settlement requested successfully!", hash, "request-settlement");
        triggerRefresh();

        return true;
      } catch (error) {
        console.error("Failed to request settlement:", error);
        toast.error("Failed to request settlement", { id: "request-settlement" });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, address, publicClient, triggerRefresh]
  );

  /**
   * Finalize settlement — the new flow in @cofhe/sdk 0.4.0:
   * 1. Read the captured ciphertext hashes from the contract
   * 2. Decrypt each off-chain via the Threshold Network (no permit needed)
   * 3. Submit the decrypted values + signatures to the contract; the contract
   *    verifies with FHE.verifyDecryptResult and completes settlement.
   * This replaces the previous on-chain FHE.decrypt + polling pattern.
   */
  const finalizeSettlement = useCallback(
    async (auctionId: bigint): Promise<boolean> => {
      if (!walletClient || !address || !publicClient) {
        toast.error("Wallet not connected");
        return false;
      }

      setIsLoading(true);

      try {
        // 1. Fetch the ctHashes captured during requestSettlement
        toast.loading("Loading settlement data...", { id: "finalize-settlement" });
        const ctHashes = (await publicClient.readContract({
          address: AUCTION_CONTRACT_ADDRESS,
          abi: sealedBidAuctionAbi,
          functionName: "getSettlementCtHashes",
          args: [auctionId],
        })) as [`0x${string}`, `0x${string}`];

        const [bidderCt, amountCt] = ctHashes;

        // 2. Decrypt both values off-chain (parallel) — no permit required
        toast.loading("Decrypting winner & amount...", { id: "finalize-settlement" });
        const [winnerResult, amountResult] = await Promise.all([
          cofheClient.decryptForTx(bidderCt).withoutPermit().execute(),
          cofheClient.decryptForTx(amountCt).withoutPermit().execute(),
        ]);

        // decryptedValue is always bigint — for eaddress we convert to a 20-byte hex string.
        const winnerHex = winnerResult.decryptedValue.toString(16).padStart(40, "0");
        const winner = `0x${winnerHex}` as `0x${string}`;
        const amount = amountResult.decryptedValue;
        const winnerProof = winnerResult.signature;
        const amountProof = amountResult.signature;

        // 3. Submit the proofs to finalize
        toast.loading("Finalizing settlement...", { id: "finalize-settlement" });
        const hash = await walletClient.writeContract({
          address: AUCTION_CONTRACT_ADDRESS,
          abi: sealedBidAuctionAbi,
          functionName: "finalizeSettlement",
          args: [auctionId, winner, amount, winnerProof, amountProof],
        });

        await publicClient.waitForTransactionReceipt({ hash });

        toastTxSuccess("Settlement finalized successfully!", hash, "finalize-settlement");
        triggerRefresh();

        return true;
      } catch (error) {
        console.error("Failed to finalize settlement:", error);
        toast.error("Failed to finalize settlement", { id: "finalize-settlement" });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, address, publicClient, triggerRefresh]
  );

  /**
   * Claim refund for a losing bid
   */
  const claimRefund = useCallback(
    async (auctionId: bigint): Promise<boolean> => {
      if (!walletClient || !address || !publicClient) {
        toast.error("Wallet not connected");
        return false;
      }

      setIsLoading(true);

      try {
        toast.loading("Claiming refund...", { id: "claim-refund" });

        const hash = await walletClient.writeContract({
          address: AUCTION_CONTRACT_ADDRESS,
          abi: sealedBidAuctionAbi,
          functionName: "claimRefund",
          args: [auctionId],
        });

        await publicClient.waitForTransactionReceipt({ hash });

        toastTxSuccess("Refund claimed successfully!", hash, "claim-refund");
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
    [walletClient, address, publicClient, triggerRefresh]
  );

  /**
   * Cancel an auction (only seller, only if no bids)
   */
  const cancelAuction = useCallback(
    async (auctionId: bigint): Promise<boolean> => {
      if (!walletClient || !address || !publicClient) {
        toast.error("Wallet not connected");
        return false;
      }

      setIsLoading(true);

      try {
        toast.loading("Cancelling auction...", { id: "cancel-auction" });

        const hash = await walletClient.writeContract({
          address: AUCTION_CONTRACT_ADDRESS,
          abi: sealedBidAuctionAbi,
          functionName: "cancelAuction",
          args: [auctionId],
        });

        await publicClient.waitForTransactionReceipt({ hash });

        toastTxSuccess("Auction cancelled successfully!", hash, "cancel-auction");
        triggerRefresh();

        return true;
      } catch (error) {
        console.error("Failed to cancel auction:", error);
        toast.error("Failed to cancel auction", { id: "cancel-auction" });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, address, publicClient, triggerRefresh]
  );

  /**
   * Get the encrypted bid deposit hash for a bidder.
   * Returns a bytes32 ciphertext hash (euint64 is bytes32 in the new FHERC20).
   * The bidder can then decrypt this value using `decryptForView` with a permit.
   */
  const getBidderDeposit = useCallback(
    async (auctionId: bigint, bidder: string): Promise<`0x${string}` | null> => {
      if (!publicClient) {
        console.error("Public client not available");
        return null;
      }

      try {
        const result = await publicClient.readContract({
          address: AUCTION_CONTRACT_ADDRESS,
          abi: sealedBidAuctionAbi,
          functionName: "getBidderDeposit",
          args: [auctionId, bidder as `0x${string}`],
        });

        return result as `0x${string}`;
      } catch (error) {
        console.error("Failed to get bidder deposit:", error);
        return null;
      }
    },
    [publicClient]
  );

  return {
    // State
    isLoading,

    // Contract addresses
    auctionContractAddress: AUCTION_CONTRACT_ADDRESS,
    nftContractAddress: NFT_CONTRACT_ADDRESS,
    tokenContractAddress: TOKEN_CONTRACT_ADDRESS,

    // Read functions
    getAuction,
    getTotalAuctions,
    getAllAuctions,
    hasBidOnAuction,
    hasClaimedRefund,
    getSettlementResult,
    isNftApproved,
    getBidderDeposit,

    // Write functions
    approveNft,
    createAuction,
    placeBid,
    requestSettlement,
    finalizeSettlement,
    claimRefund,
    cancelAuction,
  };
}
