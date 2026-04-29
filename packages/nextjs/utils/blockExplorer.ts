const ARBISCAN_URL = "https://sepolia.arbiscan.io";

export function getBlockExplorerUrl(): string {
  return ARBISCAN_URL;
}

export function getBlockExplorerTxUrl(txHash: string): string {
  return `${ARBISCAN_URL}/tx/${txHash}`;
}

export function getBlockExplorerAddressUrl(address: string): string {
  return `${ARBISCAN_URL}/address/${address}`;
}

export function formatTxHash(hash: string): string {
  if (!hash || hash.length < 16) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}
