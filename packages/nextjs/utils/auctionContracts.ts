/**
 * Contract ABIs, types, and utilities for the Sealed Bid Auction system
 */

// ============ Enums ============

/**
 * Auction status enum matching the contract
 */
export enum AuctionStatus {
  Active = 0,
  Ended = 1,
  SettlementRequested = 2,
  Settled = 3,
  Cancelled = 4,
}

// ============ TypeScript Interfaces ============

/**
 * Auction data structure from the contract
 */
export interface AuctionData {
  id: bigint;
  name: string;
  seller: `0x${string}`;
  nftContract: `0x${string}`;
  tokenId: bigint;
  fherc20Token: `0x${string}`;
  startTime: bigint;
  endTime: bigint;
  status: AuctionStatus;
  totalBids: bigint;
}

/**
 * Settlement result after auction is settled
 */
export interface SettlementResult {
  winner: `0x${string}`;
  amount: bigint;
}

// ============ Helper Functions ============

/**
 * Get a human-readable label for an auction status
 */
export function getStatusLabel(status: AuctionStatus): string {
  switch (status) {
    case AuctionStatus.Active:
      return "Active";
    case AuctionStatus.Ended:
      return "Ended";
    case AuctionStatus.SettlementRequested:
      return "Settlement Requested";
    case AuctionStatus.Settled:
      return "Settled";
    case AuctionStatus.Cancelled:
      return "Cancelled";
    default:
      return "Unknown";
  }
}

/**
 * Get DaisyUI badge class for an auction status
 */
export function getStatusColor(status: AuctionStatus): string {
  switch (status) {
    case AuctionStatus.Active:
      return "badge-success";
    case AuctionStatus.Ended:
      return "badge-warning";
    case AuctionStatus.SettlementRequested:
      return "badge-info";
    case AuctionStatus.Settled:
      return "badge-primary";
    case AuctionStatus.Cancelled:
      return "badge-error";
    default:
      return "badge-ghost";
  }
}

/**
 * Get the effective status of an auction based on contract status AND current time
 * The contract status only changes when someone calls a function, but we want to
 * show "Ended" when the time has passed even if status is still "Active"
 */
export function getEffectiveStatus(auction: AuctionData): AuctionStatus {
  const now = BigInt(Math.floor(Date.now() / 1000));

  // If contract says it's Active but time has ended, show as Ended
  if (auction.status === AuctionStatus.Active && now >= auction.endTime) {
    return AuctionStatus.Ended;
  }

  return auction.status;
}

/**
 * Get a human-readable label for an auction's effective status
 */
export function getEffectiveStatusLabel(auction: AuctionData): string {
  return getStatusLabel(getEffectiveStatus(auction));
}

/**
 * Get DaisyUI badge class for an auction's effective status
 */
export function getEffectiveStatusColor(auction: AuctionData): string {
  return getStatusColor(getEffectiveStatus(auction));
}

/**
 * Get the display title for an auction
 * Uses the on-chain name, falls back to "Auction #ID" if empty
 */
export function getAuctionDisplayTitle(auction: AuctionData): string {
  return auction.name || `Auction #${auction.id.toString()}`;
}

// ============ Contract ABIs ============

/**
 * SealedBidAuction contract ABI
 */
export const sealedBidAuctionAbi = [
  // ============ View Functions ============
  {
    inputs: [{ name: "auctionId", type: "uint256" }],
    name: "getAuction",
    outputs: [
      {
        name: "auctionView",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "seller", type: "address" },
          { name: "nftContract", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "fherc20Token", type: "address" },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "totalBids", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "auctionId", type: "uint256" }],
    name: "getSettlementResult",
    outputs: [
      { name: "winner", type: "address" },
      { name: "amount", type: "uint64" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "auctionId", type: "uint256" },
      { name: "bidder", type: "address" },
    ],
    name: "hasBidOnAuction",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "auctionId", type: "uint256" },
      { name: "bidder", type: "address" },
    ],
    name: "hasClaimedRefund",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextAuctionId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },

  // ============ Write Functions ============
  {
    inputs: [
      { name: "name", type: "string" },
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "fherc20Token", type: "address" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
    ],
    name: "createAuction",
    outputs: [{ name: "auctionId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "auctionId", type: "uint256" },
      {
        name: "encryptedAmount",
        type: "tuple",
        components: [
          { name: "ctHash", type: "uint256" },
          { name: "securityZone", type: "uint8" },
          { name: "utype", type: "uint8" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    name: "bid",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "auctionId", type: "uint256" }],
    name: "requestSettlement",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "auctionId", type: "uint256" },
      { name: "winner", type: "address" },
      { name: "amount", type: "uint64" },
      { name: "winnerProof", type: "bytes" },
      { name: "amountProof", type: "bytes" },
    ],
    name: "finalizeSettlement",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "auctionId", type: "uint256" }],
    name: "getSettlementCtHashes",
    outputs: [
      { name: "bidderCt", type: "bytes32" },
      { name: "amountCt", type: "bytes32" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "auctionId", type: "uint256" },
      { name: "bidder", type: "address" },
    ],
    name: "getBidderDeposit",
    outputs: [{ name: "deposit", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "auctionId", type: "uint256" }],
    name: "claimRefund",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "auctionId", type: "uint256" }],
    name: "cancelAuction",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ============ Events ============
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "auctionId", type: "uint256" },
      { indexed: true, name: "seller", type: "address" },
      { indexed: false, name: "name", type: "string" },
      { indexed: false, name: "nftContract", type: "address" },
      { indexed: false, name: "tokenId", type: "uint256" },
      { indexed: false, name: "fherc20Token", type: "address" },
      { indexed: false, name: "startTime", type: "uint256" },
      { indexed: false, name: "endTime", type: "uint256" },
    ],
    name: "AuctionCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "auctionId", type: "uint256" },
      { indexed: true, name: "bidder", type: "address" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
    name: "BidPlaced",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "auctionId", type: "uint256" },
      { indexed: false, name: "highestBidderCtHash", type: "bytes32" },
      { indexed: false, name: "highestBidCtHash", type: "bytes32" },
    ],
    name: "SettlementRequested",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "auctionId", type: "uint256" },
      { indexed: true, name: "winner", type: "address" },
      { indexed: false, name: "amount", type: "uint64" },
    ],
    name: "AuctionSettled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "auctionId", type: "uint256" },
      { indexed: true, name: "bidder", type: "address" },
    ],
    name: "RefundClaimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: "auctionId", type: "uint256" }],
    name: "AuctionCancelled",
    type: "event",
  },
] as const;

/**
 * AuctionNFT (ERC721) contract ABI
 */
export const auctionNftAbi = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "uri", type: "string" },
    ],
    name: "mint",
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    name: "approve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getApproved",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    name: "tokenOfOwnerByIndex",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    name: "safeTransferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    name: "setApprovalForAll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    name: "isApprovedForAll",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * AuctionToken (FHERC20) contract ABI
 */
export const auctionTokenAbi = [
  {
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint64" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "operator", type: "address" },
      { name: "until", type: "uint48" },
    ],
    name: "setOperator",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "holder", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "isOperator",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "confidentialBalanceOf",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "shield",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "amount", type: "uint64" }],
    name: "unshield",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "claimUnshielded",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "to", type: "address" },
      {
        name: "inValue",
        type: "tuple",
        components: [
          { name: "ctHash", type: "uint256" },
          { name: "securityZone", type: "uint8" },
          { name: "utype", type: "uint8" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    name: "confidentialTransfer",
    outputs: [{ name: "transferred", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    name: "confidentialTransfer",
    outputs: [{ name: "transferred", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
