import toast from "react-hot-toast";

const ARBISCAN_BASE_URL = "https://sepolia.arbiscan.io";

/**
 * Get the Arbiscan transaction URL for Arbitrum Sepolia
 */
export function getExplorerTxUrl(txHash: string): string {
  return `${ARBISCAN_BASE_URL}/tx/${txHash}`;
}

/**
 * Get the Arbiscan address URL for Arbitrum Sepolia
 */
export function getExplorerAddressUrl(address: string): string {
  return `${ARBISCAN_BASE_URL}/address/${address}`;
}

/**
 * Show a success toast with a link to view the transaction on Arbiscan
 */
export function toastTxSuccess(message: string, txHash: string, toastId?: string) {
  const explorerUrl = getExplorerTxUrl(txHash);

  toast.success(
    (t) => (
      <div className="flex flex-col gap-1">
        <span>{message}</span>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          View on Arbiscan →
        </a>
      </div>
    ),
    {
      id: toastId,
      duration: 5000,
    }
  );
}
