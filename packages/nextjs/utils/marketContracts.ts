/**
 * Contract ABIs, types, and utilities for the CipherMarket prediction market system
 */

// ============ Enums ============

export enum MarketStatus {
  Active = 0,
  Closed = 1,
  Resolved = 2,
  Settled = 3,
  Cancelled = 4,
}

export enum Outcome {
  Yes = 0,
  No = 1,
}

// ============ TypeScript Interfaces ============

export interface MarketData {
  id: bigint;
  question: string;
  creator: `0x${string}`;
  fherc20Token: `0x${string}`;
  startTime: bigint;
  endTime: bigint;
  status: MarketStatus;
  winningOutcome: Outcome;
  decryptedYesPool: bigint;
  decryptedNoPool: bigint;
  totalBets: bigint;
  yesBettors: bigint;
  noBettors: bigint;
}

// ============ Helper Functions ============

export function getStatusLabel(status: MarketStatus): string {
  switch (status) {
    case MarketStatus.Active: return "Active";
    case MarketStatus.Closed: return "Closed";
    case MarketStatus.Resolved: return "Resolving";
    case MarketStatus.Settled: return "Settled";
    case MarketStatus.Cancelled: return "Cancelled";
    default: return "Unknown";
  }
}

export function getStatusColor(status: MarketStatus): string {
  switch (status) {
    case MarketStatus.Active: return "badge-success";
    case MarketStatus.Closed: return "badge-warning";
    case MarketStatus.Resolved: return "badge-info";
    case MarketStatus.Settled: return "badge-primary";
    case MarketStatus.Cancelled: return "badge-error";
    default: return "badge-ghost";
  }
}

export function getEffectiveStatus(market: MarketData): MarketStatus {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (market.status === MarketStatus.Active && now >= market.endTime) {
    return MarketStatus.Closed;
  }
  return market.status;
}

export function getEffectiveStatusLabel(market: MarketData): string {
  return getStatusLabel(getEffectiveStatus(market));
}

export function getEffectiveStatusColor(market: MarketData): string {
  return getStatusColor(getEffectiveStatus(market));
}

export function getOutcomeLabel(outcome: Outcome): string {
  return outcome === Outcome.Yes ? "Yes" : "No";
}

export function formatTokenAmount(amount: bigint): string {
  return (Number(amount) / 1_000_000).toLocaleString();
}

// ============ Contract ABIs ============

export const cipherMarketAbi = [
  // View Functions
  {
    inputs: [{ name: "marketId", type: "uint256" }],
    name: "getMarket",
    outputs: [
      {
        name: "marketView",
        type: "tuple",
        components: [
          { name: "question", type: "string" },
          { name: "creator", type: "address" },
          { name: "fherc20Token", type: "address" },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "winningOutcome", type: "uint8" },
          { name: "decryptedYesPool", type: "uint64" },
          { name: "decryptedNoPool", type: "uint64" },
          { name: "totalBets", type: "uint256" },
          { name: "yesBettors", type: "uint256" },
          { name: "noBettors", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextMarketId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "bettor", type: "address" },
    ],
    name: "hasBetOnMarket",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "bettor", type: "address" },
    ],
    name: "getBettorOutcome",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "bettor", type: "address" },
    ],
    name: "hasClaimedFromMarket",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "marketId", type: "uint256" }],
    name: "getSettlementCtHashes",
    outputs: [
      { name: "yesCt", type: "bytes32" },
      { name: "noCt", type: "bytes32" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "bettor", type: "address" },
    ],
    name: "getBettorDeposit",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  // Write Functions
  {
    inputs: [
      { name: "question", type: "string" },
      { name: "fherc20Token", type: "address" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
    ],
    name: "createMarket",
    outputs: [{ name: "marketId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "outcome", type: "uint8" },
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
    name: "placeBet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "winningOutcome", type: "uint8" },
    ],
    name: "resolveMarket",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "yesPoolTotal", type: "uint64" },
      { name: "noPoolTotal", type: "uint64" },
      { name: "yesProof", type: "bytes" },
      { name: "noProof", type: "bytes" },
    ],
    name: "finalizeSettlement",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "marketId", type: "uint256" }],
    name: "requestBetDecryption",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "decryptedBetAmount", type: "uint64" },
      { name: "betProof", type: "bytes" },
    ],
    name: "claimWinnings",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "marketId", type: "uint256" }],
    name: "claimRefund",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "marketId", type: "uint256" }],
    name: "cancelMarket",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "marketId", type: "uint256" },
      { indexed: true, name: "creator", type: "address" },
      { indexed: false, name: "question", type: "string" },
      { indexed: false, name: "fherc20Token", type: "address" },
      { indexed: false, name: "startTime", type: "uint256" },
      { indexed: false, name: "endTime", type: "uint256" },
    ],
    name: "MarketCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "marketId", type: "uint256" },
      { indexed: true, name: "bettor", type: "address" },
      { indexed: false, name: "outcome", type: "uint8" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
    name: "BetPlaced",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "marketId", type: "uint256" },
      { indexed: false, name: "winningOutcome", type: "uint8" },
    ],
    name: "MarketResolved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "marketId", type: "uint256" },
      { indexed: false, name: "yesPoolCtHash", type: "bytes32" },
      { indexed: false, name: "noPoolCtHash", type: "bytes32" },
    ],
    name: "SettlementRequested",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "marketId", type: "uint256" },
      { indexed: false, name: "yesPoolTotal", type: "uint64" },
      { indexed: false, name: "noPoolTotal", type: "uint64" },
    ],
    name: "MarketSettled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "marketId", type: "uint256" },
      { indexed: true, name: "bettor", type: "address" },
      { indexed: false, name: "payout", type: "uint256" },
    ],
    name: "WinningsClaimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "marketId", type: "uint256" },
      { indexed: true, name: "bettor", type: "address" },
    ],
    name: "RefundClaimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: "marketId", type: "uint256" }],
    name: "MarketCancelled",
    type: "event",
  },
] as const;

export const betTokenAbi = [
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
] as const;